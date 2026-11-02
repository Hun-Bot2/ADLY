# ALDY — Algorithm Daily

User-requested product rename, 2026-10-30.

The UI, native main-window title, initial learning window, startup HTML and macOS product bundle now use ALDY (Algorithm Daily). The sidebar monogram is A, with ALDY and Algorithm Daily as the visible brand. Root/desktop README headings and the active run command were updated.

Files: desktop/src-tauri/{tauri.conf.json,src/main.rs,placeholder/index.html,placeholder/onboarding.html}, desktop/ui/index.html, hosted/public/index.html, ReadME.md and desktop/README.md. Browser/native smoke assertions verify the new title.

The app identifier local.algorithm-mastery.da0.tauri, existing AlgorithmMastery app-data path, credential names, storage keys and internal executable are intentionally unchanged. No schema, settings reset, learner-data move or repository rename occurs. Earlier receipts and documentation snapshots keep their historical names.

Validation: Node356 and Rust6 passed; actual Playwright document/sidebar branding and existing appearance/persistence checks passed. The rendered ALDY sidebar was inspected. Tauri macOS arm64 unsigned ALDY.app built successfully. Its Info.plist reports CFBundleName/CFBundleDisplayName ALDY and the unchanged bundle identifier. Native WebView reported ALDY — Algorithm Daily; light/dark/system and exit0 passed. Startup close/cancel/new smoke passed. Package audit verified117 resource files, no forbidden data.

Receipts: [native](receipts/aldy-native.json), [startup](receipts/aldy-onboarding.json), [package audit](receipts/aldy-package-audit.json). Native screenshot/contrast, Windows host behavior and signing remain outside this rename verification. All learner writes used disposable test data.

Quit the previous app, then run:

```sh
open "desktop/src-tauri/target/release/bundle/macos/ALDY.app"
```

Suggested commit: `chore(branding): rename desktop product to ALDY`.
No commit or push performed.
