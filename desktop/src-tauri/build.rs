fn main() {
    // Startup renders before Node is available: embed the same offline design assets.
    let manifest = std::path::PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let public = manifest.join("../../hosted/public");
    for relative in [
        "design-system.css",
        "fonts/PretendardVariable.woff2",
        "fonts/JetBrainsMonoVariable.woff2",
        "fonts/Pretendard-LICENSE.txt",
        "fonts/JetBrainsMono-LICENSE.txt",
    ] {
        let source = public.join(relative);
        let destination = manifest.join("placeholder").join(relative);
        println!("cargo:rerun-if-changed={}", source.display());
        std::fs::create_dir_all(destination.parent().unwrap()).expect("startup asset directory");
        let bytes = std::fs::read(&source).expect("shared startup design asset");
        if std::fs::read(&destination).ok().as_deref() != Some(bytes.as_slice()) {
            std::fs::write(&destination, bytes).expect("startup asset copy");
        }
    }

    println!("cargo:rerun-if-env-changed=ALDY_GITHUB_CLIENT_ID");
    // A device-flow client ID is public (no secret exists); the committed file is the default for builds.
    let client_file = manifest.join("github-client-id.txt");
    println!("cargo:rerun-if-changed={}", client_file.display());
    if std::env::var_os("ALDY_GITHUB_CLIENT_ID").is_none() {
        if let Ok(value) = std::fs::read_to_string(&client_file) {
            let value = value.trim();
            if !value.is_empty() && value.len() <= 120 && value.chars().all(|c| c.is_ascii_alphanumeric() || "_.-".contains(c)) {
                println!("cargo:rustc-env=ALDY_GITHUB_CLIENT_ID={value}");
            }
        }
    }
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "auth_begin",
            "auth_complete",
            "auth_status",
            "auth_sign_out",
            "github_repositories",
            "github_create_repository",
            "da0_probe",
            "set_appearance",
            "pick_folder",
            "first_run_choose",
        ]),
    ))
    .expect("Tauri candidate build configuration failed");
}
