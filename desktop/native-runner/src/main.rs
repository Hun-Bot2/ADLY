use mastery_native_runner::{Request, error_response, run};
use std::io::{self, Read};
fn main() {
    let mut input = String::new();
    let result = (|| -> Result<serde_json::Value, String> {
        io::stdin()
            .take(2 * 1024 * 1024 + 1)
            .read_to_string(&mut input)
            .map_err(|e| e.to_string())?;
        if input.len() > 2 * 1024 * 1024 {
            return Err("request exceeds 2 MiB".into());
        }
        let value = serde_json::from_str(&input).map_err(|e| e.to_string())?;
        let request = Request::parse(&value)?;
        run(request).map_err(|e| e.to_string())
    })();
    match result {
        Ok(value) => println!("{value}"),
        Err(error) => {
            println!("{}", error_response(error));
            std::process::exit(1);
        }
    }
}
