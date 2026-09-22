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
`pnpm tauri build` builds the complete desktop application. Those native build
steps could not be run in the implementation environment because `rustc` was
not installed.
