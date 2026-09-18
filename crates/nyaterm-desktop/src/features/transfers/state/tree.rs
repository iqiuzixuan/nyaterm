//! Session-local directory caches. No listing request is issued by presentation.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use gpui::{FocusHandle, ScrollStrategy, UniformListScrollHandle};
use nyaterm_transport::{RemoteFilePath, SftpFileEntry};

#[derive(Clone)]
pub(in crate::features) struct TransferTreeRow {
    pub key: String,
    pub path: RemoteFilePath,
    pub label: String,
    pub depth: usize,
    pub directory: bool,
    pub expanded: bool,
    pub loading: bool,
    pub error: Option<String>,
    pub entry: Option<SftpFileEntry>,
}

#[derive(Clone)]
pub(in crate::features) struct TransferTreePresentation {
    pub visible: bool,
    pub rows: Arc<[TransferTreeRow]>,
    pub selected: Option<String>,
    pub scroll: UniformListScrollHandle,
}

struct DirectoryNode {
    path: RemoteFilePath,
    entries: Option<Arc<Vec<SftpFileEntry>>>,
    pending: Option<u64>,
    error: Option<String>,
}

impl DirectoryNode {
    fn new(path: RemoteFilePath) -> Self {
        Self {
            path,
            entries: None,
            pending: None,
            error: None,
        }
    }
}

#[derive(Default)]
struct TreeSession {
    root: Option<RemoteFilePath>,
    nodes: HashMap<String, DirectoryNode>,
    expanded: HashSet<String>,
    selected: Option<String>,
    scroll: UniformListScrollHandle,
    scroll_to_selection: bool,
    rows: Arc<[TransferTreeRow]>,
    dirty: bool,
    show_hidden: bool,
}

pub(super) struct TransferTreeState {
    sessions: HashMap<String, TreeSession>,
    visible: bool,
    next_generation: u64,
}

impl Default for TransferTreeState {
    fn default() -> Self {
        Self {
            sessions: HashMap::new(),
            visible: true,
            next_generation: 0,
        }
    }
}

// Valid UTF-8 tokens and display-only paths denote the same directory; invalid
// UTF-8 paths must retain their byte identity even when their labels collide.
fn key(path: &RemoteFilePath) -> String {
    match path.raw_path() {
        Ok(Some(raw)) if std::str::from_utf8(&raw).ok() == Some(path.display_path.as_str()) => {
            path.display_path.clone()
        }
        _ => path.identity_key(),
    }
}

impl TransferTreeState {
    pub(super) fn toggle_visible(&mut self) {
        self.visible = !self.visible;
    }

    pub(super) fn remove_session(&mut self, session: &str) {
        self.sessions.remove(session);
    }

    pub(super) fn replace_session(&mut self, old: &str, new: &str) {
        if let Some(state) = self.sessions.remove(old) {
            self.sessions.insert(new.to_string(), state);
        }
    }

    pub(super) fn presentation(
        &mut self,
        session: Option<&str>,
        show_hidden: bool,
    ) -> TransferTreePresentation {
        let state = self
            .sessions
            .entry(session.unwrap_or_default().to_string())
            .or_default();
        if state.dirty || state.show_hidden != show_hidden {
            state.show_hidden = show_hidden;
            let mut rows = Vec::new();
            if let Some(root) = &state.root {
                state.append_rows(root, None, 0, &mut HashSet::new(), &mut rows);
            }
            state.rows = rows.into();
            state.dirty = false;
            if state.scroll_to_selection
                && let Some(index) = state
                    .selected
                    .as_ref()
                    .and_then(|selected| state.rows.iter().position(|row| &row.key == selected))
            {
                state.scroll.scroll_to_item(index, ScrollStrategy::Center);
                state.scroll_to_selection = false;
            }
        }
        TransferTreePresentation {
            visible: self.visible,
            rows: state.rows.clone(),
            selected: state.selected.clone(),
            scroll: state.scroll.clone(),
        }
    }

    pub(super) fn seed(
        &mut self,
        session: &str,
        path: RemoteFilePath,
        entries: Arc<Vec<SftpFileEntry>>,
    ) {
        let state = self.sessions.entry(session.to_string()).or_default();
        state.apply_listing(path, entries);
    }

    /// Reveal also returns the missing ancestor listings, for the runtime adapter.
    pub(super) fn reveal(&mut self, session: &str, path: RemoteFilePath) -> Vec<RemoteFilePath> {
        let state = self.sessions.entry(session.to_string()).or_default();
        let mut chain = Vec::new();
        let mut current = path.clone();
        let mut seen = HashSet::new();
        for _ in 0..64 {
            if !seen.insert(key(&current)) {
                break;
            }
            chain.push(current.clone());
            if matches!(current.display_path.as_str(), "/" | ".") {
                break;
            }
            let Ok(parent) = current.parent() else {
                break;
            };
            if key(&parent) == key(&current) {
                break;
            }
            current = parent;
        }
        state.root = chain.last().cloned();
        state.selected = Some(key(&path));
        state.scroll_to_selection = true;
        let mut missing = Vec::new();
        for path in chain.into_iter().rev() {
            let id = key(&path);
            state.expanded.insert(id.clone());
            let node = state
                .nodes
                .entry(id)
                .or_insert_with(|| DirectoryNode::new(path));
            if node.entries.is_none() && node.pending.is_none() {
                missing.push(node.path.clone());
            }
        }
        state.dirty = true;
        missing
    }

    pub(super) fn begin_request(&mut self, session: &str, path: RemoteFilePath) -> Option<u64> {
        let state = self.sessions.entry(session.to_string()).or_default();
        let node = state
            .nodes
            .entry(key(&path))
            .or_insert_with(|| DirectoryNode::new(path));
        if node.pending.is_some() || node.entries.is_some() {
            return None;
        }
        self.next_generation += 1;
        node.pending = Some(self.next_generation);
        node.error = None;
        state.dirty = true;
        Some(self.next_generation)
    }

    pub(super) fn complete(
        &mut self,
        session: &str,
        path: &RemoteFilePath,
        generation: u64,
        result: Result<Vec<SftpFileEntry>, String>,
    ) -> bool {
        let Some(state) = self.sessions.get_mut(session) else {
            return false;
        };
        let Some(node) = state.nodes.get_mut(&key(path)) else {
            return false;
        };
        if node.pending != Some(generation) {
            return false;
        }
        node.pending = None;
        match result {
            Ok(entries) => state.apply_listing(path.clone(), Arc::new(entries)),
            Err(error) => {
                node.error = Some(error);
                state.dirty = true;
            }
        }
        true
    }

    pub(super) fn invalidate(&mut self, session: &str, path: &RemoteFilePath, subtree: bool) {
        let Some(state) = self.sessions.get_mut(session) else {
            return;
        };
        let id = key(path);
        if subtree {
            state.remove_subtree(&id, &mut HashSet::new());
        } else if let Some(node) = state.nodes.get_mut(&id) {
            node.entries = None;
            node.pending = None;
            node.error = None;
        }
        state.dirty = true;
    }

    pub(super) fn select(&mut self, session: &str, id: String) {
        if let Some(state) = self.sessions.get_mut(session) {
            state.selected = Some(id);
        }
    }

    pub(super) fn toggle(
        &mut self,
        session: &str,
        id: &str,
        expand: Option<bool>,
    ) -> Option<RemoteFilePath> {
        let state = self.sessions.get_mut(session)?;
        let node = state.nodes.get_mut(id)?;
        state.selected = Some(id.to_string());
        let expand = expand.unwrap_or(!state.expanded.contains(id));
        if expand {
            state.expanded.insert(id.to_string());
        } else {
            state.expanded.remove(id);
        }
        // Expanding an errored directory explicitly retries it.
        state.dirty = true;
        (expand && node.entries.is_none() && node.pending.is_none()).then(|| node.path.clone())
    }

    pub(super) fn move_selection(&mut self, session: &str, delta: isize) {
        let Some(state) = self.sessions.get_mut(session) else {
            return;
        };
        if state.rows.is_empty() {
            return;
        }
        let index = state
            .selected
            .as_ref()
            .and_then(|id| state.rows.iter().position(|row| &row.key == id))
            .unwrap_or(0);
        let next = index.saturating_add_signed(delta).min(state.rows.len() - 1);
        state.selected = Some(state.rows[next].key.clone());
        state.scroll.scroll_to_item(next, ScrollStrategy::Top);
    }

    pub(super) fn selected_row(&self, session: &str) -> Option<TransferTreeRow> {
        let state = self.sessions.get(session)?;
        state
            .rows
            .iter()
            .find(|row| Some(&row.key) == state.selected.as_ref())
            .cloned()
    }

    pub(super) fn select_parent(&mut self, session: &str, id: &str) {
        let Some(state) = self.sessions.get_mut(session) else {
            return;
        };
        let Some(index) = state.rows.iter().position(|row| row.key == id) else {
            return;
        };
        let depth = state.rows[index].depth;
        if let Some(row) = state.rows[..index]
            .iter()
            .rev()
            .find(|row| row.depth < depth)
        {
            state.selected = Some(row.key.clone());
        }
    }
}

impl TreeSession {
    fn apply_listing(&mut self, path: RemoteFilePath, entries: Arc<Vec<SftpFileEntry>>) {
        let id = key(&path);
        if self.nodes.get(&id).is_some_and(|node| {
            node.pending.is_none() && node.entries.as_deref() == Some(entries.as_ref())
        }) {
            return;
        }
        // Invalidate removed directories, but keep unrelated siblings' caches.
        let retained: HashSet<String> = entries
            .iter()
            .filter(|e| e.is_directory())
            .map(|e| key(&e.remote_path()))
            .collect();
        let removed: Vec<String> = self
            .nodes
            .get(&id)
            .and_then(|node| node.entries.as_ref())
            .into_iter()
            .flat_map(|entries| entries.iter())
            .filter(|entry| entry.is_directory())
            .map(|e| key(&e.remote_path()))
            .filter(|id| !retained.contains(id))
            .collect();
        for id in removed {
            self.remove_subtree(&id, &mut HashSet::new());
        }
        for entry in entries
            .iter()
            .filter(|e| e.is_directory() && e.name != "." && e.name != "..")
        {
            self.nodes
                .entry(key(&entry.remote_path()))
                .or_insert_with(|| DirectoryNode::new(entry.remote_path()));
        }
        let node = self
            .nodes
            .entry(id)
            .or_insert_with(|| DirectoryNode::new(path));
        node.entries = Some(entries);
        node.pending = None;
        node.error = None;
        self.dirty = true;
    }

    fn remove_subtree(&mut self, id: &str, seen: &mut HashSet<String>) {
        if !seen.insert(id.to_string()) {
            return;
        }
        if let Some(node) = self.nodes.remove(id)
            && let Some(entries) = node.entries
        {
            for entry in entries.iter().filter(|e| e.is_directory()) {
                self.remove_subtree(&key(&entry.remote_path()), seen);
            }
        }
        self.expanded.remove(id);
    }

    fn append_rows(
        &self,
        path: &RemoteFilePath,
        entry: Option<&SftpFileEntry>,
        depth: usize,
        visited: &mut HashSet<String>,
        rows: &mut Vec<TransferTreeRow>,
    ) {
        let id = key(path);
        if depth >= 64 || !visited.insert(id.clone()) {
            return;
        }
        let node = self.nodes.get(&id);
        let directory = entry.is_none_or(SftpFileEntry::is_directory);
        let expanded = directory && self.expanded.contains(&id);
        rows.push(TransferTreeRow {
            key: id,
            path: path.clone(),
            label: entry
                .map(|e| e.name.clone())
                .unwrap_or_else(|| path.display_path.clone()),
            depth,
            directory,
            expanded,
            loading: node.is_some_and(|n| n.pending.is_some()),
            error: node.and_then(|n| n.error.clone()),
            entry: entry.cloned(),
        });
        if expanded && let Some(entries) = node.and_then(|node| node.entries.as_ref()) {
            let mut sorted: Vec<&SftpFileEntry> = entries
                .iter()
                .filter(|e| {
                    e.name != "."
                        && e.name != ".."
                        && (self.show_hidden || !e.name.starts_with('.'))
                })
                .collect();
            sorted.sort_by(|a, b| {
                b.is_directory()
                    .cmp(&a.is_directory())
                    .then_with(|| super::browser_logic::natural_compare_ascii(&a.name, &b.name))
            });
            for entry in sorted {
                self.append_rows(&entry.remote_path(), Some(entry), depth + 1, visited, rows);
            }
        }
    }
}

impl super::TransferFeatureState {
    pub(in crate::features) fn tree_is_initialized(&self, session: &str) -> bool {
        self.tree
            .sessions
            .get(session)
            .is_some_and(|state| state.root.is_some())
    }
    pub(in crate::features) fn missing_expanded_tree_paths(
        &self,
        session: &str,
    ) -> Vec<RemoteFilePath> {
        if !self.tree.visible {
            return Vec::new();
        }
        self.tree
            .sessions
            .get(session)
            .into_iter()
            .flat_map(|state| {
                state
                    .expanded
                    .iter()
                    .filter_map(|id| state.nodes.get(id))
                    .filter(|node| {
                        node.entries.is_none() && node.pending.is_none() && node.error.is_none()
                    })
                    .map(|node| node.path.clone())
            })
            .collect()
    }
    pub(in crate::features) fn tree_presentation(
        &mut self,
        session: Option<&str>,
        show_hidden: bool,
    ) -> TransferTreePresentation {
        self.tree.presentation(session, show_hidden)
    }
    pub(in crate::features) fn toggle_tree_visible(&mut self) {
        self.tree.toggle_visible();
    }
    pub(in crate::features) fn seed_tree_listing(
        &mut self,
        session: &str,
        path: RemoteFilePath,
        entries: Arc<Vec<SftpFileEntry>>,
    ) {
        self.tree.seed(session, path, entries);
    }
    pub(in crate::features) fn reveal_tree_path(
        &mut self,
        session: &str,
        path: RemoteFilePath,
    ) -> Vec<RemoteFilePath> {
        self.tree.reveal(session, path)
    }
    pub(in crate::features) fn begin_tree_request(
        &mut self,
        session: &str,
        path: RemoteFilePath,
    ) -> Option<u64> {
        self.tree.begin_request(session, path)
    }
    pub(in crate::features) fn complete_tree_request(
        &mut self,
        session: &str,
        path: &RemoteFilePath,
        generation: u64,
        result: Result<Vec<SftpFileEntry>, String>,
    ) -> bool {
        self.tree.complete(session, path, generation, result)
    }
    pub(in crate::features) fn invalidate_tree_path(
        &mut self,
        session: &str,
        path: &RemoteFilePath,
        subtree: bool,
    ) {
        self.tree.invalidate(session, path, subtree);
    }
    pub(in crate::features) fn select_tree_row(&mut self, session: &str, id: String) {
        self.tree.select(session, id);
    }
    pub(in crate::features) fn toggle_tree_node(
        &mut self,
        session: &str,
        id: &str,
        expand: Option<bool>,
    ) -> Option<RemoteFilePath> {
        self.tree.toggle(session, id, expand)
    }
    pub(in crate::features) fn move_tree_selection(&mut self, session: &str, delta: isize) {
        self.tree.move_selection(session, delta);
    }
    pub(in crate::features) fn selected_tree_row(&self, session: &str) -> Option<TransferTreeRow> {
        self.tree.selected_row(session)
    }
    pub(in crate::features) fn select_tree_parent(&mut self, session: &str, id: &str) {
        self.tree.select_parent(session, id);
    }
    pub(in crate::features) fn tree_focus(&self) -> &FocusHandle {
        &self.tree_focus
    }
}

#[cfg(test)]
mod tests {
    use super::TransferTreeState;
    use nyaterm_transport::{RemoteFilePath, SftpFileEntry, SftpFileType};
    use std::sync::Arc;

    fn directory(name: &str, path: &str) -> SftpFileEntry {
        SftpFileEntry {
            name: name.into(),
            path: path.into(),
            file_type: SftpFileType::Directory,
            size: None,
            permissions: None,
            owner: String::new(),
            group: String::new(),
            modified_at: None,
            raw_path_token: None,
            symlink_target_is_directory: false,
        }
    }

    #[test]
    fn invalidation_rejects_old_results_and_preserves_other_parents() {
        let mut tree = TransferTreeState::default();
        tree.seed(
            "a",
            RemoteFilePath::new("/"),
            Arc::new(vec![directory("one", "/one"), directory("two", "/two")]),
        );
        let old = tree
            .begin_request("a", RemoteFilePath::new("/one"))
            .unwrap();
        let two = tree
            .begin_request("a", RemoteFilePath::new("/two"))
            .unwrap();
        tree.invalidate("a", &RemoteFilePath::new("/one"), false);
        assert!(!tree.complete("a", &RemoteFilePath::new("/one"), old, Ok(vec![])));
        assert!(tree.complete("a", &RemoteFilePath::new("/two"), two, Ok(vec![])));
        let new = tree
            .begin_request("a", RemoteFilePath::new("/one"))
            .unwrap();
        assert_ne!(old, new);
    }

    #[test]
    fn session_scope_raw_identity_and_keyboard_selection_are_independent() {
        let mut tree = TransferTreeState::default();
        let mut first = directory("same", "/same");
        first.raw_path_token = RemoteFilePath::from_raw("/same", b"/\xff").raw_path_token;
        let mut second = first.clone();
        second.raw_path_token = RemoteFilePath::from_raw("/same", b"/\xfe").raw_path_token;
        tree.seed("a", RemoteFilePath::new("/"), Arc::new(vec![first, second]));
        tree.reveal("a", RemoteFilePath::new("/"));
        let view = tree.presentation(Some("a"), false);
        assert_eq!(view.rows.len(), 3);
        assert_ne!(view.rows[1].key, view.rows[2].key);
        tree.move_selection("a", 1);
        assert_eq!(tree.selected_row("a").unwrap().depth, 1);
        assert_eq!(tree.presentation(Some("b"), false).rows.len(), 0);
        tree.remove_session("a");
        assert!(tree.presentation(Some("a"), false).rows.is_empty());
    }

    #[test]
    fn reveal_missing_ancestors_and_seed_supersede_pending_listings() {
        let mut tree = TransferTreeState::default();
        let pending = tree
            .begin_request("a", RemoteFilePath::new("/a/b"))
            .unwrap();
        tree.seed("a", RemoteFilePath::new("/a/b"), Arc::new(vec![]));
        assert!(!tree.complete(
            "a",
            &RemoteFilePath::new("/a/b"),
            pending,
            Ok(vec![directory("old", "/a/b/old")])
        ));
        let missing = tree.reveal("a", RemoteFilePath::new("/a/b"));
        assert_eq!(
            missing
                .iter()
                .map(|p| p.display_path.as_str())
                .collect::<Vec<_>>(),
            vec!["/", "/a"]
        );
        assert!(tree.sessions["a"].scroll_to_selection);
        tree.seed(
            "a",
            RemoteFilePath::new("/"),
            Arc::new(vec![directory("a", "/a")]),
        );
        tree.seed(
            "a",
            RemoteFilePath::new("/a"),
            Arc::new(vec![directory("b", "/a/b")]),
        );
        tree.presentation(Some("a"), false);
        assert!(!tree.sessions["a"].scroll_to_selection);
    }
}
