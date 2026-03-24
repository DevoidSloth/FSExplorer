mod scanner;

use scanner::{DirEntry, DirNode, DriveInfo, ScanSummary};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, State};

struct ScanState {
    cancel_flag: Arc<AtomicBool>,
}

/// Holds the full in-memory tree after a scan completes.
/// Children are served on demand via `get_children`.
struct TreeState {
    tree: Option<DirNode>,
}

#[tauri::command]
fn list_drives() -> Vec<DriveInfo> {
    scanner::list_drives()
}

#[tauri::command]
async fn scan_drive(
    drive: String,
    app: AppHandle,
    scan_state: State<'_, Mutex<ScanState>>,
    tree_state: State<'_, Mutex<TreeState>>,
) -> Result<ScanSummary, String> {
    // Reset cancel flag
    {
        let s = scan_state.lock().unwrap();
        s.cancel_flag.store(false, Ordering::Relaxed);
    }

    let cancel_flag = {
        let s = scan_state.lock().unwrap();
        Arc::clone(&s.cancel_flag)
    };

    #[cfg(target_os = "windows")]
    let root = format!("{}\\", drive.trim_end_matches('\\'));

    #[cfg(not(target_os = "windows"))]
    let root = {
        let s = drive.trim_end_matches('/');
        if s.is_empty() { "/".to_string() } else { s.to_string() }
    };

    let (tree, summary) = tokio::task::spawn_blocking(move || {
        scanner::scan_drive(&root, app, cancel_flag)
            .ok_or_else(|| "Scan cancelled or failed".to_string())
    })
    .await
    .map_err(|e| e.to_string())??;

    // Store the full tree in memory — children served lazily via get_children
    {
        let mut ts = tree_state.lock().unwrap();
        ts.tree = Some(tree);
    }

    Ok(summary)
}

#[tauri::command]
fn get_children(
    path: String,
    tree_state: State<'_, Mutex<TreeState>>,
) -> Result<Vec<DirEntry>, String> {
    let ts = tree_state.lock().unwrap();
    let tree = ts
        .tree
        .as_ref()
        .ok_or_else(|| "No scan data available".to_string())?;
    Ok(scanner::get_children(tree, &path))
}

#[tauri::command]
fn cancel_scan(state: State<'_, Mutex<ScanState>>) {
    let s = state.lock().unwrap();
    s.cancel_flag.store(true, Ordering::Relaxed);
}

#[tauri::command]
async fn open_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn delete_path(
    path: String,
    is_dir: bool,
    tree_state: State<'_, Mutex<TreeState>>,
) -> Result<(), String> {
    if is_dir {
        std::fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
    } else {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    // Invalidate cached tree so stale data isn't served
    {
        let mut ts = tree_state.lock().unwrap();
        ts.tree = None;
    }
    Ok(())
}

#[tauri::command]
fn get_file_size_string(bytes: u64) -> String {
    format_size(bytes)
}

fn format_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;
    const TB: u64 = GB * 1024;

    if bytes >= TB {
        format!("{:.2} TB", bytes as f64 / TB as f64)
    } else if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.0} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(ScanState {
            cancel_flag: Arc::new(AtomicBool::new(false)),
        }))
        .manage(Mutex::new(TreeState { tree: None }))
        .invoke_handler(tauri::generate_handler![
            list_drives,
            scan_drive,
            cancel_scan,
            get_children,
            open_in_explorer,
            delete_path,
            get_file_size_string,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
