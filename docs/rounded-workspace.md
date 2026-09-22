# Rounded workspace UI

The desktop shell uses separate rounded cards for the sidebars, terminal windows,
and bottom tools. This is a layout refactor of the existing React/Tauri client;
SSH, terminal I/O, SFTP, AI execution and persistence services are unchanged.

![Rounded workspace with the existing GitHub Dark theme](images/rounded-workspace.png)

The screenshot uses the real frontend with sample connection and terminal data.
Native macOS traffic-light controls are provided by Tauri and are absent from
this browser capture.

## Layout and interaction

- The title bar can collapse either sidebar or the bottom tools. Collapsing a
  card retains the mounted content, including command drafts and active sends.
- Sidebar activities appear horizontally above their panel. Bottom actions stay
  below it. The existing ordering, hiding, labels, context menus and drag-to-move
  behavior remain available. A sidebar with no active panel becomes a narrow
  activity rail; floating mode continues to use activity rails and overlays.
- Terminal window splits are individual cards separated by resize gutters.
  Tab dragging, docking, colors, close actions and terminal pane splits use the
  existing session/workspace handlers.
- The bottom card exposes quick commands, transfers, history and command sending.
  It reuses the existing components and command handlers. The transfer queue
  remains accessible from the file explorer too. The tab strip supports arrow,
  Home and End keys.
- Resize handles accept mouse, pen or touch input, and release pointer listeners
  when cancelled, blurred or unmounted. Focused handles support arrow keys (8px)
  and Shift+arrow keys (24px).
- Below 900px the right sidebar becomes an overlay; below 640px the left sidebar
  does too. Title-bar controls and the backdrop open/close the overlays without
  squeezing the terminal to zero width.
- Settings windows use the same card geometry. Panel headings use spacing and
  typography instead of a separate colored strip and heavy separator.

## Compact desktop density

![Compact asset list with borderless actions](images/compact-assets.png)

The spacing pass follows the installed VS Code 1.138.0 workbench styles
(`workbench.desktop.main.css`), including its modern editor tabs. The local
VS Code preference places the activity bar at the top. The release version was
also checked against the [official release notes](https://code.visualstudio.com/updates/v1_138).
Live VS Code window capture was unavailable because ScreenCaptureKit returned
error -3811; the comparison uses local styles and the supplied screenshots.

- Main and child title bars: 32px, with matching native macOS button placement.
- Session tab strip: 32px; individual tabs: 24px with 4px corners and regular
  12px labels. Active tabs use the theme's hover surface. The default accent
  underline is removed; explicit custom tab colors retain their subtle marker.
- Workspace cards: 8px corners, 4px gutters, and a border mixed to 45% of the
  existing theme border. Increased-contrast preferences restore the full border.
- Activity and small toolbar controls: 24px with 16px activity icons. Shared
  buttons, inputs and selects default to 28px, with 24px small variants and
  4px corners. Explicit component size overrides remain supported.
- Connection rows and panel headings use tighter spacing and regular text.
- Asset list rows are 40px instead of 56px; virtualization uses the same height.
  Asset actions and view toggles are borderless, showing a surface on hover or
  keyboard focus. The official custom-tag filters remain unchanged.
- Settings use 12px section padding, 8px field gaps and 16px section gaps;
  dialogs use 16px padding. Controls retain visible keyboard focus indicators.

This changes presentation only. Theme palettes, terminal font sizes, saved
connections, tab actions and application behavior are retained.

## Themes and saved preferences

`src/styles/workspace.css` defines geometry and uses the existing `--df-*` theme
variables for every surface, text color, border and selection. No theme palette,
terminal ANSI palette or theme selection has been replaced. Wallpaper and window
transparency still go through `buildSurfaceCssVariables`.

New installs place connections on the left and AI on the right. Frontend main
and child-window defaults match the Rust defaults. Existing saved activity layouts,
widths and panel selections remain in use; there is no forced migration or new
settings schema. The existing reset-layout action can apply the new activity
placement. Header collapse state and auxiliary bottom-tab selection are local to
an open window; persisted panel sizes and existing quick-command/send visibility
continue using the original settings fields.

## Validation

Run the frontend checks from the repository root:

```sh
pnpm exec tsc --noEmit
pnpm exec vitest run
pnpm lint
pnpm exec vite build
```

Focused regression coverage includes horizontal activity dragging, keyboard and
pointer resizing, cancellation/unmount cleanup, sidebar content retention, bottom
tool switching, draft retention and revealing incoming send-command drafts.

Implementation checks: TypeScript and the production Vite build passed; all
810 tests in 130 files passed. Lint reported no errors and one existing hook
dependency warning in `CommandSuggestions.tsx`. Vite also reports the existing
large-chunk advisory.

The browser UI was also exercised with the real frontend and an isolated Tauri
IPC fixture: terminal rendering, sidebar collapse, transfers, responsive overlays,
and theme-derived surfaces. The fixture is not part of the production entrypoint.
It does not establish SSH/SFTP connectivity or native macOS window behavior.

A native package additionally requires Rust/Cargo and the usual Tauri platform
prerequisites. `pnpm build` builds the Rust MCP sidecar before the frontend;
`pnpm tauri build` builds the complete desktop application.

The macOS arm64 release build passed with Rust/Cargo 1.98.1, including the MCP
sidecar and frontend, using this local-package command:

```sh
pnpm tauri build --ci --bundles app --config '{"bundle":{"createUpdaterArtifacts":false}}'
```

The resulting `src-tauri/target/release/bundle/macos/NyaTerm.app` contains arm64
executables for both the app and MCP sidecar. Its Info.plist passed validation,
and `codesign --verify --deep --strict` passed. The package uses the project's
ad-hoc signing configuration and is not notarized; updater artifacts were disabled
only for this local build. The installed application was not replaced, and this
build check does not establish native runtime or live SSH/SFTP behavior.
