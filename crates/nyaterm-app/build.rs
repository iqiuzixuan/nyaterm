fn main() {
    // `rust_embed` expands to `include_bytes!` for the files that exist when the
    // macro runs, so cargo only tracks those paths. Without this, adding or
    // removing an asset leaves a stale `EmbeddedAssets` and the new icon 404s at
    // runtime until something else forces `assets.rs` to recompile.
    println!("cargo:rerun-if-changed=assets");
    println!("cargo:rerun-if-changed=resources/icons/icon.ico");

    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        compile_windows_resources();
    }
}

fn compile_windows_resources() {
    let manifest_dir = std::path::PathBuf::from(
        std::env::var("CARGO_MANIFEST_DIR").expect("Cargo manifest directory"),
    );
    let icon = manifest_dir.join("resources/icons/icon.ico");
    let icon = icon.to_string_lossy().replace('\\', "\\\\");
    let out_dir = std::path::PathBuf::from(std::env::var("OUT_DIR").expect("Cargo OUT_DIR"));
    let resource = out_dir.join("nyaterm.rc");

    // GPUI's Windows backend loads the application icon from resource ID 1
    // and assigns it to the registered window class used by taskbar windows.
    std::fs::write(&resource, format!("1 ICON \"{icon}\"\n"))
        .expect("write NyaTerm Windows resource script");
    embed_resource::compile(&resource, embed_resource::NONE)
        .manifest_optional()
        .expect("compile NyaTerm Windows resources");
}
