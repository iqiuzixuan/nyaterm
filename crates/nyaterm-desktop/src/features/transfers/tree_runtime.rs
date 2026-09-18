use std::sync::Arc;

use gpui::{Context, KeyDownEvent, Window};
use nyaterm_transport::{RemoteFilePath, SftpFileEntry};

use crate::features::NyaTermApp;
use crate::models::{
    TransferJobEvent, TransferJobKind, TransferJobOutput, TransferJobResult, TransferJobState,
    TransferJobStatus,
};

impl NyaTermApp {
    pub(super) fn request_missing_expanded_tree_listings(&mut self, cx: &mut Context<Self>) {
        let Some(session) = self.session.active_id_owned() else {
            return;
        };
        for path in self.transfer.missing_expanded_tree_paths(&session) {
            self.request_transfer_tree_listing(path, cx);
        }
    }
    fn request_transfer_tree_listing(&mut self, path: RemoteFilePath, cx: &mut Context<Self>) {
        let Some(session_id) = self.session.active_id_owned() else {
            return;
        };
        let service = match self.active_file_browser_service() {
            Ok(service) => service,
            Err(_) => return,
        };
        let Some(generation) = self.transfer.begin_tree_request(&session_id, path.clone()) else {
            return;
        };
        let id = self.transfer.next_transfer_job_id("sftp-tree");
        self.transfer.enqueue_transfer_job(TransferJobState {
            id: id.clone(),
            session_id: Some(session_id),
            kind: TransferJobKind::ListTree {
                path: path.clone(),
                generation,
            },
            status: TransferJobStatus::Running,
            detail: String::new(),
            created_at_ms: TransferJobState::now_ms(),
            display_name: String::new(),
            entries: Vec::new(),
            summary: None,
            progress: None,
            control: None,
            speed: Default::default(),
        });
        let tx = self.transfer.transfer_event_sender();
        self.submit_transfer_blocking_job("sftp-tree-listing", id.clone(), tx.clone(), move || {
            let result = service
                .list_dir_path(&path)
                .map(TransferJobOutput::TreeEntries)
                .map_err(|error| error.to_string());
            let _ = tx.unbounded_send(TransferJobResult {
                id,
                event: TransferJobEvent::Finished(result),
            });
        });
        cx.notify();
    }

    pub(in crate::features) fn reveal_transfer_tree_current_path(
        &mut self,
        cx: &mut Context<Self>,
    ) {
        if self.session.active_file_browser_backend()
            == Some(nyaterm_transport::FileBrowserBackendKind::Local)
        {
            return;
        }
        let Some(session_id) = self.session.active_id_owned() else {
            return;
        };
        let path = self.transfer.browser_remote_file_path();
        let missing = self.transfer.reveal_tree_path(&session_id, path);
        for path in missing {
            self.request_transfer_tree_listing(path, cx);
        }
    }

    pub(in crate::features) fn toggle_transfer_tree(&mut self, cx: &mut Context<Self>) {
        self.transfer.toggle_tree_visible();
        self.reveal_transfer_tree_current_path(cx);
        cx.notify();
    }

    pub(in crate::features) fn select_transfer_tree_row(
        &mut self,
        key: String,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        if let Some(session) = self.session.active_id_owned() {
            self.transfer.select_tree_row(&session, key);
        }
        self.transfer.tree_focus().focus(window, cx);
        cx.notify();
    }

    pub(in crate::features) fn expand_transfer_tree_row(
        &mut self,
        key: &str,
        expand: Option<bool>,
        cx: &mut Context<Self>,
    ) {
        let Some(session) = self.session.active_id_owned() else {
            return;
        };
        if let Some(path) = self.transfer.toggle_tree_node(&session, key, expand) {
            self.request_transfer_tree_listing(path, cx);
        }
        cx.notify();
    }

    pub(in crate::features) fn navigate_transfer_tree_row(
        &mut self,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let Some(session) = self.session.active_id_owned() else {
            return;
        };
        let Some(row) = self.transfer.selected_tree_row(&session) else {
            return;
        };
        if row.directory {
            if let Some(entry) = row.entry {
                self.open_transfer_browser_entry_directory(entry, window, cx);
            } else {
                self.open_transfer_browser_directory(row.path.display_path, window, cx);
            }
        } else if let Some(entry) = row.entry {
            self.open_transfer_default(entry, window, cx);
        }
    }

    pub(in crate::features) fn handle_transfer_tree_key_down(
        &mut self,
        event: &KeyDownEvent,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let Some(session) = self.session.active_id_owned() else {
            return;
        };
        let row = self.transfer.selected_tree_row(&session);
        match event.keystroke.key.as_str() {
            "up" => self.transfer.move_tree_selection(&session, -1),
            "down" => self.transfer.move_tree_selection(&session, 1),
            "left" => {
                if let Some(row) = row {
                    if row.expanded {
                        self.expand_transfer_tree_row(&row.key, Some(false), cx);
                    } else {
                        self.transfer.select_tree_parent(&session, &row.key);
                    }
                }
            }
            "right" => {
                if let Some(row) = row {
                    if row.directory && !row.expanded {
                        self.expand_transfer_tree_row(&row.key, Some(true), cx);
                    } else {
                        self.transfer.move_tree_selection(&session, 1);
                    }
                }
            }
            "enter" => self.navigate_transfer_tree_row(window, cx),
            _ => return,
        }
        cx.stop_propagation();
        cx.notify();
    }

    /// Apply already-fetched write listings and invalidate just affected parents.
    pub(super) fn update_transfer_tree_from_output(
        &mut self,
        session: &str,
        output: &TransferJobOutput,
    ) {
        let seed = |app: &mut Self, path: &str, entries: &[SftpFileEntry]| {
            let path = RemoteFilePath::new(path);
            app.transfer.invalidate_tree_path(session, &path, false);
            app.transfer
                .seed_tree_listing(session, path, Arc::new(entries.to_vec()));
        };
        match output {
            TransferJobOutput::CwdSynced {
                remote_path,
                entries,
            } => seed(self, remote_path, entries),
            TransferJobOutput::Renamed {
                old_path,
                parent_path,
                entries,
                ..
            } => {
                self.transfer
                    .invalidate_tree_path(session, &RemoteFilePath::new(old_path), true);
                seed(self, parent_path, entries);
            }
            TransferJobOutput::Moved {
                old_path,
                new_path,
                parent_path,
                entries,
            } => {
                self.transfer
                    .invalidate_tree_path(session, &RemoteFilePath::new(old_path), true);
                if let Ok(parent) = RemoteFilePath::new(new_path).parent() {
                    self.transfer.invalidate_tree_path(session, &parent, false);
                }
                seed(self, parent_path, entries);
            }
            TransferJobOutput::Deleted {
                remote_path,
                parent_path,
                entries,
            } => {
                self.transfer.invalidate_tree_path(
                    session,
                    &RemoteFilePath::new(remote_path),
                    true,
                );
                seed(self, parent_path, entries);
            }
            TransferJobOutput::CreatedDirectory {
                remote_path,
                parent_path,
                entries,
                open_after_create,
            } => {
                if *open_after_create {
                    self.transfer.invalidate_tree_path(
                        session,
                        &RemoteFilePath::new(parent_path),
                        false,
                    );
                    seed(self, remote_path, entries);
                } else {
                    seed(self, parent_path, entries);
                }
            }
            TransferJobOutput::Uploaded {
                parent_path,
                entries,
                ..
            }
            | TransferJobOutput::CreatedFile {
                parent_path,
                entries,
                ..
            }
            | TransferJobOutput::CreatedSymlink {
                parent_path,
                entries,
                ..
            }
            | TransferJobOutput::PropertiesUpdated {
                parent_path,
                entries,
                ..
            } => seed(self, parent_path, entries),
            TransferJobOutput::Sent {
                target_session_id,
                target_parent_path,
                entries,
                ..
            } => {
                self.transfer.invalidate_tree_path(
                    target_session_id,
                    &RemoteFilePath::new(target_parent_path),
                    false,
                );
                self.transfer.seed_tree_listing(
                    target_session_id,
                    RemoteFilePath::new(target_parent_path),
                    Arc::new(entries.clone()),
                );
            }
            _ => {}
        }
    }
}
