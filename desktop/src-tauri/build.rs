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

    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "auth_begin",
            "auth_complete",
            "auth_status",
            "auth_sign_out",
            "da0_probe",
            "set_appearance",
            "first_run_choose",
        ]),
    ))
    .expect("Tauri candidate build configuration failed");
}
