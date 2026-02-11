use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::mpsc::channel;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use super::types::{FileChangeEvent, FileChangeKind};

pub struct FileWatcher {
    watcher: Option<RecommendedWatcher>,
    watched_path: Option<PathBuf>,
}

impl FileWatcher {
    pub fn new() -> Self {
        Self {
            watcher: None,
            watched_path: None,
        }
    }

    pub fn watch(&mut self, path: PathBuf, app_handle: AppHandle) -> Result<(), String> {
        // Stop existing watcher
        self.stop();

        let (tx, rx) = channel();

        let mut watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    let _ = tx.send(event);
                }
            },
            Config::default().with_poll_interval(Duration::from_secs(1)),
        )
        .map_err(|e| e.to_string())?;

        watcher
            .watch(&path, RecursiveMode::Recursive)
            .map_err(|e| e.to_string())?;

        self.watcher = Some(watcher);
        self.watched_path = Some(path.clone());

        // Spawn thread to process events
        thread::spawn(move || {
            while let Ok(event) = rx.recv() {
                for path in event.paths {
                    // Skip hidden files and .notemaker directory internals
                    if let Some(name) = path.file_name() {
                        let name_str = name.to_string_lossy();
                        if name_str.starts_with('.') && name_str != ".notemaker" {
                            continue;
                        }
                    }

                    // Skip non-markdown files for note events
                    let is_md = path.extension().map(|e| e == "md").unwrap_or(false);
                    let is_dir = path.is_dir();

                    if !is_md && !is_dir {
                        continue;
                    }

                    let kind = match event.kind {
                        notify::EventKind::Create(_) => FileChangeKind::Create,
                        notify::EventKind::Modify(_) => FileChangeKind::Modify,
                        notify::EventKind::Remove(_) => FileChangeKind::Delete,
                        _ => continue,
                    };

                    let change_event = FileChangeEvent {
                        path: path.clone(),
                        kind,
                    };

                    let _ = app_handle.emit("file-changed", change_event);
                }
            }
        });

        Ok(())
    }

    pub fn stop(&mut self) {
        self.watcher = None;
        self.watched_path = None;
    }

    pub fn is_watching(&self) -> bool {
        self.watcher.is_some()
    }

    pub fn watched_path(&self) -> Option<&PathBuf> {
        self.watched_path.as_ref()
    }
}

impl Default for FileWatcher {
    fn default() -> Self {
        Self::new()
    }
}

/// Global file watcher state
pub type WatcherState = Arc<Mutex<FileWatcher>>;

/// Start watching a vault directory
#[tauri::command]
pub async fn start_watching(
    path: PathBuf,
    app_handle: AppHandle,
    watcher_state: tauri::State<'_, WatcherState>,
) -> Result<(), String> {
    let mut watcher = watcher_state.lock().map_err(|e| e.to_string())?;
    watcher.watch(path, app_handle)
}

/// Stop watching
#[tauri::command]
pub async fn stop_watching(watcher_state: tauri::State<'_, WatcherState>) -> Result<(), String> {
    let mut watcher = watcher_state.lock().map_err(|e| e.to_string())?;
    watcher.stop();
    Ok(())
}
