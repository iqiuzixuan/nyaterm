# Tauri to GPUI Backport Tracking

Baselines: Tauri `d62d69e9`, GPUI `c253525e`, assessed on 2026-09-17.
The reference checkout under `temp/nyaterm-tauri` is read-only and can be older
than the baseline. Nothing under `temp/` is part of the build.

## Delivery Status

All four stages are implemented and delivered as four ordered commits:
AI fixes, domain/storage/transport foundations, GPUI integration, and this
acceptance record. Separate PRs for items 1-14 are no longer required, per the
2026-09-18 delivery decision. The foundation and GPUI integration commits form
one dependent application change and should be kept or reverted together.
Implementation status is not a claim that every platform/manual acceptance
check is complete.

| Item | Feature | Status |
| --- | --- | --- |
| 1 | Claude Code default model fallback | Implemented with normalization tests |
| 2 | Non-interactive agent commands | Implemented for base, Codex and Claude prompts |
| 3 | SSH known-host management | Implemented with store and stale-request tests |
| 4 | Copy public key from saved private key | Implemented with published OpenSSH test vectors |
| 5 | Notes Markdown tree export | Implemented with filesystem and revision guards |
| 6 | SSH config import and host-key aliases | Implemented with recursive parsing, route graph validation, key import and atomic ID remapping |
| 7 | SFTP compatibility mode and diagnostics | Implemented and automation-validated with session-scoped cache/gate, persistent executors, serial directory transfers and redacted diagnostics; real-server acceptance pending |
| 8 | Reusable accounts | Implemented with typed sources, metadata-only connection-source loads, SSH/Telnet runtime integration, six locales and portable compatibility tests |
| 9 | First-class connection tags | Implemented and automation-validated with legacy fallback, authoritative dual write, editor controls, dynamic asset filters and portable-snapshot coverage |
| 10 | SFTP tree beside the existing file list | Implemented with session-local cache, generations, precise invalidation, virtualized keyboard UI and path reveal |
| 11 | Serial XMODEM/YMODEM uploads | Implemented with transport state machines, worker integration, progress/cancel flow, context menu and drop protocol selection |
| 12 | Session-local terminal search wrap toggle | Implemented as a default-on, non-persisted search option with boundary tests |
| 13 | Optional bold default foreground | Implemented as a default-off sparse appearance setting with explicit-color preservation tests |
| 14 | Cache-only file hover details | Implemented on tree rows without additional remote operations |

## Stage-One Boundaries

- Known hosts retain existing table names, stable database IDs and record formats.
  Invalid/raw records stay out of the list and survive single-entry deletion.
  Clear-all removes SSH entries only, including raw lines, and leaves RDP records.
- Known-host mutations are serialized independently of tab changes and secret
  operations. Generations reject stale reads; buttons are disabled during work.
- Public-key extraction never decrypts an OpenSSH payload or reveals/persists
  private or derived public data. Clipboard completion is rejected after locking
  or switching tabs. Unsupported PEM and corrupt input return redacted errors.
- Notes use one store read transaction for the complete persisted snapshot.
  The core plans portable names and hierarchy without filesystem access.
  The desktop blocking scheduler reserves a new unique root and writes files
  exclusively. Failure cleanup can target only that operation's reserved root.
- Open editors remain the sole owners of draft state. Export reads weak editor
  entities rather than mirrored dirty flags, and verifies snapshot revisions.
- UI additions use `nyaterm-ui`; all six existing catalogs receive equivalent
  keys and placeholders (en, zh-CN, zh-TW, ko, ja, fr).

## Stage-Three And Four Boundaries

- The SFTP tree supplements the existing flat browser. It reuses the current
  remote-file service and stale-result policy; row tooltips read only cached
  listing metadata.
- X/YMODEM protocol parsing and retry state live in `nyaterm-transport`.
  Desktop workers own blocking file reads and translate deterministic actions
  into the existing transfer-job and serial-output paths.
- Terminal search wrapping is session-local runtime state and is never written
  to application settings.
- Bold default foreground is persisted only when enabled. It affects bold cells
  without an explicit ANSI/truecolor foreground and leaves explicit colors
  unchanged.

## Acceptance Tracking

- Core tests: passed in the full workspace run (314 tests, 1 ignored).
- Desktop tests: passed in the full workspace run (1382 tests, 5 ignored).
- Store tests: passed in the full workspace run (106 tests).
- Transport tests: passed in the full workspace run (306 tests); the
  environment-dependent SFTP E2E remains ignored.
- Application and workspace checks: passed.
- Full workspace tests and doctests: passed on 2026-09-18.
- Formatting: passed.
- Workspace clippy with `-D warnings`: passed on 2026-09-18.
- X/YMODEM worker stop/restart releases upload file handles on Windows in the
  automated lifecycle test.
- Windows real-window smoke tests: pending (tab overflow/focus, clipboard lock
  races, destructive confirmations, directory picker, export status feedback,
  SFTP tree navigation and search/appearance controls).
- Real-server/device acceptance remains pending for SFTP compatibility/tree
  behavior and serial X/YMODEM interoperability/reopen behavior.

## Next Delivery Gates

1. Review the ordered commit series without changing the compatibility contracts
   established by the backport. Keep the foundation and GPUI integration commits
   together when applying or reverting the series.
2. Complete item 7 real-server acceptance. Automated peer tests already cover
   session reuse, serialization, closure and endpoint scopes. Compatible services
   share a per-session cache and gate, using a persistent dedicated executor or
   their multiplex executor; disposable-server directory-transfer validation is
   still required.
3. Preserve the automation-validated stage-two compatibility contracts during
   review. Sanitized GPUI and Tauri connection fixtures,
   unknown-field/default-field round trips, portable snapshots and account/tag
   compatibility tests are present. Keep redb keys, encryption, document keys
   and legacy `password_id` meanings unchanged. SSH config expands
   implicit/overridden nested routes, imports all identity files with
   canonical-path deduplication, handles globbed Include directories, replays
   shared Include files in different Host blocks and enforces resource limits.
   Unsupported Match conditions fail explicitly instead of changing another Host.
4. Run Windows real-window acceptance, disposable SFTP-server tests and serial
   loopback/device interoperability before declaring the backport ready
   for release.
