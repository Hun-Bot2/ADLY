//! Job Object runner for user-owned local code. This is not a sandbox.
use serde_json::{Value, json};
use std::io;

#[derive(Debug)]
pub struct Request {
    pub command: String,
    pub args: Vec<String>,
    pub cwd: String,
    pub input: String,
    pub timeout_ms: u64,
    pub cpu_seconds: u64,
    pub memory_bytes: usize,
    pub output_limit: usize,
}
impl Request {
    pub fn parse(value: &Value) -> Result<Self, String> {
        let text = |key: &str| {
            value[key]
                .as_str()
                .map(str::to_owned)
                .ok_or_else(|| format!("{key} must be a string"))
        };
        let number = |key: &str, default, min, max| {
            let n = match value.get(key) {
                None => default,
                Some(v) => v.as_u64().ok_or_else(|| format!("invalid {key}"))?,
            };
            if n < min || n > max {
                return Err(format!("{key} out of range"));
            }
            Ok(n)
        };
        let command = text("command")?;
        let cwd = text("cwd")?;
        let args: Vec<String> = value["args"]
            .as_array()
            .ok_or("args must be an array")?
            .iter()
            .map(|v| {
                v.as_str()
                    .map(str::to_owned)
                    .ok_or("argument must be a string")
            })
            .collect::<Result<_, _>>()?;
        let input = value
            .get("input")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_owned();
        if command.is_empty()
            || cwd.is_empty()
            || command.contains('\0')
            || cwd.contains('\0')
            || args.iter().any(|v| v.contains('\0'))
            || args.len() > 256
            || input.len() > 1024 * 1024
        {
            return Err("invalid command, working directory, arguments or oversized input".into());
        }
        if command_line(&command, &args).encode_utf16().count() >= 32767 {
            return Err("command line too long".into());
        }
        Ok(Self {
            command,
            args,
            cwd,
            input,
            timeout_ms: number("timeoutMs", 5000, 1, 60000)?,
            cpu_seconds: number("cpuSeconds", 5, 1, 60)?,
            memory_bytes: number(
                "memoryBytes",
                512 * 1024 * 1024,
                16 * 1024 * 1024,
                4 * 1024 * 1024 * 1024,
            )? as usize,
            output_limit: number("outputLimit", 1024 * 1024, 1, 1024 * 1024)? as usize,
        })
    }
}
/// Microsoft C runtime argument quoting (also handles a quote after trailing backslashes).
pub fn quote_argument(value: &str) -> String {
    let mut result = String::from("\"");
    let mut slashes = 0;
    for c in value.chars() {
        if c == '\\' {
            slashes += 1;
            continue;
        }
        if c == '"' {
            result.push_str(&"\\".repeat(slashes * 2 + 1));
            result.push('"');
        } else {
            result.push_str(&"\\".repeat(slashes));
            result.push(c);
        }
        slashes = 0;
    }
    result.push_str(&"\\".repeat(slashes * 2));
    result.push('"');
    result
}
pub fn command_line(command: &str, args: &[String]) -> String {
    std::iter::once(command)
        .chain(args.iter().map(String::as_str))
        .map(quote_argument)
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(windows)]
mod windows;
#[cfg(windows)]
pub fn run(request: Request) -> io::Result<Value> {
    windows::run(request)
}
#[cfg(not(windows))]
pub fn run(_: Request) -> io::Result<Value> {
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "native Job Object runner is Windows-only",
    ))
}
pub fn error_response(error: impl ToString) -> Value {
    json!({"error":error.to_string()})
}

#[cfg(test)]
mod tests {
    use super::*;
    fn request() -> Value {
        json!({"command":"C:\\Program Files\\Python\\python.exe","args":["한 # %.py"],"cwd":"C:\\data"})
    }
    #[test]
    fn quotes_empty_spaces_quotes_and_trailing_slashes() {
        assert_eq!(quote_argument(""), "\"\"");
        assert_eq!(quote_argument("hello world"), "\"hello world\"");
        assert_eq!(quote_argument("a\"b"), "\"a\\\"b\"");
        assert_eq!(quote_argument("C:\\space dir\\"), "\"C:\\space dir\\\\\"");
    }
    #[test]
    fn validates_limits_before_execution() {
        let mut v = request();
        let r = Request::parse(&v).unwrap();
        assert_eq!(r.memory_bytes, 512 * 1024 * 1024);
        for key in ["timeoutMs", "outputLimit", "cpuSeconds", "memoryBytes"] {
            v = request();
            v[key] = json!(0);
            assert!(Request::parse(&v).is_err());
        }
        v = request();
        v["command"] = json!("bad\u{0000}command");
        assert!(Request::parse(&v).is_err());
        v = request();
        v["args"] = json!([5]);
        assert!(Request::parse(&v).is_err());
        v = request();
        v["input"] = json!("x".repeat(1024 * 1024 + 1));
        assert!(Request::parse(&v).is_err());
    }
    #[test]
    fn command_lines_preserve_native_paths() {
        let r = Request::parse(&request()).unwrap();
        assert!(command_line(&r.command, &r.args).contains("한 # %.py"));
    }
    #[cfg(not(windows))]
    #[test]
    fn other_platforms_fail_closed() {
        assert_eq!(
            run(Request::parse(&request()).unwrap()).unwrap_err().kind(),
            io::ErrorKind::Unsupported
        );
    }
}
