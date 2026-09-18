use gpui::{
    Context, IntoElement, KeyDownEvent, ParentElement as _, SharedString, Styled as _, div,
    prelude::*, px, rgb, svg, uniform_list,
};
use nyaterm_transport::{SftpFileEntry, SftpFileType};
use nyaterm_ui::{NyaButton, NyaButtonVariant, NyaUniformListScrollbar};
use rust_i18n::t;

use super::panel::TransferPanel;

pub(super) fn transfer_tree_view(
    panel: &TransferPanel,
    cx: &mut Context<TransferPanel>,
) -> impl IntoElement {
    let snapshot = panel.snapshot().expect("transfer snapshot");
    let palette = snapshot.chrome.palette;
    let tree = &snapshot.browser.tree;
    let count = tree.rows.len();
    let scroll = tree.scroll.clone();
    div()
        .id("transfer-directory-tree")
        .w(px(148.))
        .flex_none()
        .h_full()
        .min_h_0()
        .flex()
        .flex_col()
        .border_r_1()
        .border_color(rgb(palette.border))
        .overflow_hidden()
        .track_focus(&snapshot.browser.tree_focus)
        .on_key_down(cx.listener(|panel, event: &KeyDownEvent, window, cx| {
            panel.with_app(cx, |app, cx| {
                app.handle_transfer_tree_key_down(event, window, cx)
            });
        }))
        .child(
            div()
                .h(px(28.))
                .flex_none()
                .px_2()
                .flex()
                .items_center()
                .justify_between()
                .text_size(px(11.))
                .text_color(rgb(palette.text_muted))
                .child(t!("fileExplorer.tree"))
                .child(
                    NyaButton::new("transfer-tree-reveal", "")
                        .icon("icons/fe/folder-sync.svg")
                        .compact()
                        .variant(NyaButtonVariant::Ghost)
                        .tooltip(t!("fileExplorer.revealCurrentPath"))
                        .on_click(cx.listener(|panel, _, _, cx| {
                            panel.with_app(cx, |app, cx| app.reveal_transfer_tree_current_path(cx));
                        })),
                ),
        )
        .child(
            div()
                .relative()
                .flex_1()
                .min_h_0()
                .overflow_hidden()
                .child(
                    uniform_list(
                        "transfer-tree-rows",
                        count,
                        cx.processor(|panel, range: std::ops::Range<usize>, _, cx| {
                            let Some(snapshot) = panel.snapshot() else {
                                return Vec::new();
                            };
                            let palette = snapshot.chrome.palette;
                            let tree = &snapshot.browser.tree;
                            let rows = tree.rows.clone();
                            let selected = tree.selected.clone();
                            range
                                .filter_map(|index| rows.get(index).cloned())
                                .map(|row| {
                                    let id = row.key.clone();
                                    let expand_id = row.key.clone();
                                    let icon = if row.directory {
                                        "icons/conn/folder.svg"
                                    } else {
                                        "icons/conn/file.svg"
                                    };
                                    let hover_details =
                                        row.entry.as_ref().map(transfer_tree_hover_details);
                                    div()
                                        .id(SharedString::from(format!(
                                            "transfer-tree-row:{}",
                                            row.key
                                        )))
                                        .h(px(28.))
                                        .w_full()
                                        .min_w_0()
                                        .flex()
                                        .items_center()
                                        .gap_1()
                                        .pl(px((row.depth.min(8) * 12) as f32))
                                        .pr_1()
                                        .bg(if selected.as_ref() == Some(&row.key) {
                                            rgb(palette.hover)
                                        } else {
                                            gpui::rgba(0)
                                        })
                                        .text_size(px(11.))
                                        .text_color(rgb(palette.text))
                                        .cursor_pointer()
                                        .hover(|this| this.bg(rgb(palette.hover)))
                                        .on_click(cx.listener(
                                            move |panel, event: &gpui::ClickEvent, window, cx| {
                                                cx.stop_propagation();
                                                panel.with_app(cx, |app, cx| {
                                                    app.select_transfer_tree_row(
                                                        id.clone(),
                                                        window,
                                                        cx,
                                                    );
                                                    if event.click_count() == 2 {
                                                        app.navigate_transfer_tree_row(window, cx);
                                                    }
                                                });
                                            },
                                        ))
                                        .child(div().w(px(22.)).h(px(24.)).flex_none().when(
                                            row.directory,
                                            |this| {
                                                this.child(
                                                    NyaButton::new(
                                                        SharedString::from(format!(
                                                            "tree-expand:{}",
                                                            row.key
                                                        )),
                                                        "",
                                                    )
                                                    .icon(if row.expanded {
                                                        "icons/chevron-down.svg"
                                                    } else {
                                                        "icons/menu/chevron-right.svg"
                                                    })
                                                    .compact()
                                                    .variant(NyaButtonVariant::Ghost)
                                                    .loading(row.loading)
                                                    .tooltip(if row.expanded {
                                                        t!("fileExplorer.collapseFolder")
                                                    } else {
                                                        t!("fileExplorer.expandFolder")
                                                    })
                                                    .on_click(cx.listener(
                                                        move |panel, _, window, cx| {
                                                            cx.stop_propagation();
                                                            panel.with_app(cx, |app, cx| {
                                                                app.select_transfer_tree_row(
                                                                    expand_id.clone(),
                                                                    window,
                                                                    cx,
                                                                );
                                                                app.expand_transfer_tree_row(
                                                                    &expand_id, None, cx,
                                                                );
                                                            });
                                                        },
                                                    )),
                                                )
                                            },
                                        ))
                                        .child(svg().size(px(13.)).flex_none().path(icon))
                                        .child(
                                            div()
                                                .min_w_0()
                                                .flex_1()
                                                .overflow_hidden()
                                                .text_ellipsis()
                                                .child(row.label),
                                        )
                                        .when_some(row.error, |this, error| {
                                            this.child(
                                                div()
                                                    .id(SharedString::from(format!(
                                                        "tree-error:{}",
                                                        row.key
                                                    )))
                                                    .flex_none()
                                                    .text_color(rgb(palette.text_muted))
                                                    .child("!")
                                                    .tooltip(move |window, cx| {
                                                        nyaterm_ui::NyaTooltip::new(error.clone())
                                                            .build(window, cx)
                                                    }),
                                            )
                                        })
                                        .when_some(hover_details, |this, details| {
                                            this.tooltip(move |window, cx| {
                                                nyaterm_ui::NyaTooltip::new(details.clone())
                                                    .build(window, cx)
                                            })
                                        })
                                        .into_any_element()
                                })
                                .collect()
                        }),
                    )
                    .size_full()
                    .track_scroll(&scroll),
                )
                .child(
                    div()
                        .absolute()
                        .inset_0()
                        .child(NyaUniformListScrollbar::new(
                            "transfer-tree-scrollbar",
                            &scroll,
                        )),
                ),
        )
}

fn transfer_tree_hover_details(entry: &SftpFileEntry) -> String {
    let kind = match entry.file_type {
        SftpFileType::File => t!("fileExplorer.typeFile"),
        SftpFileType::Directory => t!("fileExplorer.typeDirectory"),
        SftpFileType::Symlink if entry.symlink_target_is_directory => {
            t!("fileExplorer.typeDirectorySymlink")
        }
        SftpFileType::Symlink => t!("fileExplorer.typeSymlink"),
        SftpFileType::Other => t!("fileExplorer.typeOther"),
    };
    let mut lines = vec![entry.name.clone(), kind.to_string()];
    if let Some(size) = entry.size.filter(|_| !entry.is_directory()) {
        lines.push(
            t!(
                "fileExplorer.detailSize",
                value = crate::features::transfers::format_file_size(Some(size))
            )
            .to_string(),
        );
    }
    if let Some(mode) = entry.permissions {
        lines.push(
            t!(
                "fileExplorer.detailPermissions",
                value = crate::features::formatting::format_permissions_octal(mode)
            )
            .to_string(),
        );
    }
    if !entry.owner.is_empty() || !entry.group.is_empty() {
        lines.push(
            t!(
                "fileExplorer.detailOwner",
                value = format!("{}:{}", entry.owner, entry.group)
            )
            .to_string(),
        );
    }
    let modified = super::format_sftp_modified(entry.modified_at);
    if !modified.is_empty() {
        lines.push(t!("fileExplorer.detailModified", value = modified).to_string());
    }
    lines.join("\n")
}

#[cfg(test)]
mod tests {
    use nyaterm_transport::{SftpFileEntry, SftpFileType};

    use super::transfer_tree_hover_details;

    #[test]
    fn hover_details_use_only_cached_entry_metadata() {
        let entry = SftpFileEntry {
            name: "report.txt".into(),
            path: "/report.txt".into(),
            file_type: SftpFileType::File,
            size: Some(1536),
            permissions: Some(0o100640),
            owner: "alice".into(),
            group: "staff".into(),
            modified_at: Some(1_700_000_000),
            raw_path_token: None,
            symlink_target_is_directory: false,
        };
        let details = transfer_tree_hover_details(&entry);
        assert!(details.starts_with("report.txt\n"));
        assert!(details.contains("1.5 KiB"));
        assert!(details.contains("0640"));
        assert!(details.contains("alice:staff"));
    }
}
