use jwalk::{Parallelism, WalkDir};
use rayon::prelude::*;
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Clone, Debug)]
pub struct DirNode {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
    pub file_type: String,
    pub children: Vec<DirNode>,
}

/// Lightweight version sent over IPC — children stripped to avoid giant payloads.
#[derive(Serialize, Clone, Debug)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
    pub file_type: String,
    pub child_count: usize,
}

#[derive(Serialize, Clone, Debug)]
pub struct ScanSummary {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub file_count: u64,
}

#[derive(Serialize, Clone)]
pub struct ScanProgress {
    pub files_scanned: u64,
    pub current_path: String,
}

#[derive(Serialize, Clone)]
pub struct DriveInfo {
    pub letter: String,
    pub label: String,
    pub total: u64,
    pub free: u64,
}

// Skip directories that are inaccessible, virtual, or cause hangs
#[cfg(target_os = "windows")]
const SKIP_DIRS: &[&str] = &[
    "System Volume Information",
    "$Recycle.Bin",
    "$WINDOWS.~BT",
    "$WINDOWS.~WS",
    "$WinREAgent",
    "WpSystem",
    "Recovery",
    "Config.Msi",
];

#[cfg(target_os = "macos")]
const SKIP_DIRS: &[&str] = &[
    ".Spotlight-V100",   // Spotlight index — permission denied
    ".fseventsd",        // FSEvents log — permission denied
    ".vol",              // Virtual inode filesystem — causes hang
    "dev",               // Device filesystem — virtual, causes hang
];

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
const SKIP_DIRS: &[&str] = &[];

pub fn list_drives() -> Vec<DriveInfo> {
    let mut drives = Vec::new();

    #[cfg(target_os = "macos")]
    {
        use std::ffi::CString;

        // Enumerate /Volumes to find mounted volumes.
        // Symlinks in /Volumes typically point back to "/" (the root volume).
        let mut root_label = String::from("Macintosh HD");
        let mut external_mounts: Vec<(String, String)> = Vec::new();

        if let Ok(entries) = std::fs::read_dir("/Volumes") {
            for entry in entries.flatten() {
                let path = entry.path();
                let name = entry.file_name().to_string_lossy().into_owned();

                if path.is_symlink() {
                    // Symlink pointing to / — this is the root volume's alias name
                    if let Ok(target) = std::fs::read_link(&path) {
                        if target == std::path::Path::new("/") {
                            root_label = name;
                        }
                    }
                } else if path.is_dir() {
                    external_mounts.push((path.to_string_lossy().into_owned(), name));
                }
            }
        }

        // Root volume first, then external mounts
        let mut mounts = vec![("/".to_string(), root_label)];
        mounts.extend(external_mounts);

        for (mount_path, label) in mounts {
            let c_path = match CString::new(mount_path.as_bytes()) {
                Ok(s) => s,
                Err(_) => continue,
            };

            let mut stat: libc::statvfs = unsafe { std::mem::zeroed() };
            if unsafe { libc::statvfs(c_path.as_ptr(), &mut stat) } != 0 {
                continue;
            }

            let block_size = stat.f_frsize as u64;
            if block_size == 0 {
                continue;
            }
            let total = stat.f_blocks as u64 * block_size;
            let free = stat.f_bavail as u64 * block_size;

            if total == 0 {
                continue;
            }

            drives.push(DriveInfo {
                letter: mount_path,
                label,
                total,
                free,
            });
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::ffi::OsString;
        use std::os::windows::ffi::OsStringExt;
        use windows::Win32::Storage::FileSystem::{
            GetDiskFreeSpaceExW, GetDriveTypeW, GetLogicalDrives, GetVolumeInformationW,
        };

        const DRIVE_FIXED: u32 = 3;
        const DRIVE_REMOVABLE: u32 = 2;

        let mask = unsafe { GetLogicalDrives() };

        for i in 0..26u32 {
            if mask & (1 << i) == 0 {
                continue;
            }

            let letter = (b'A' + i as u8) as char;
            let root: Vec<u16> = format!("{}:\\\0", letter).encode_utf16().collect();

            let drive_type = unsafe { GetDriveTypeW(windows::core::PCWSTR(root.as_ptr())) };
            if drive_type != DRIVE_FIXED && drive_type != DRIVE_REMOVABLE {
                continue;
            }

            let mut total_bytes = 0u64;
            let mut free_bytes = 0u64;

            let _ = unsafe {
                GetDiskFreeSpaceExW(
                    windows::core::PCWSTR(root.as_ptr()),
                    None,
                    Some(&mut total_bytes as *mut u64 as *mut _),
                    Some(&mut free_bytes as *mut u64 as *mut _),
                )
            };

            let mut label_buf = vec![0u16; 256];
            let label = unsafe {
                let ok = GetVolumeInformationW(
                    windows::core::PCWSTR(root.as_ptr()),
                    Some(label_buf.as_mut_slice()),
                    None,
                    None,
                    None,
                    None,
                );
                if ok.is_ok() {
                    let len = label_buf.iter().position(|&c| c == 0).unwrap_or(0);
                    OsString::from_wide(&label_buf[..len])
                        .to_string_lossy()
                        .into_owned()
                } else {
                    String::new()
                }
            };

            drives.push(DriveInfo {
                letter: format!("{}:", letter),
                label,
                total: total_bytes,
                free: free_bytes,
            });
        }
    }

    drives
}

fn categorize_extension(ext: &str) -> &'static str {
    match ext.to_ascii_lowercase().as_str() {
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" | "svg" | "ico" | "heic" | "heif"
        | "raw" | "tiff" | "tif" | "avif" => "image",
        "mp4" | "mkv" | "avi" | "mov" | "wmv" | "flv" | "webm" | "m4v" | "mpg" | "mpeg"
        | "3gp" => "video",
        "mp3" | "flac" | "wav" | "aac" | "ogg" | "m4a" | "wma" | "opus" | "aiff" => "audio",
        "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" | "iso" | "cab" | "lzh"
        | "zst" | "lz4" => "archive",
        "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "txt" | "odt" | "ods"
        | "odp" | "rtf" | "csv" | "epub" | "mobi" => "document",
        "js" | "mjs" | "cjs" | "ts" | "jsx" | "tsx" | "py" | "rs" | "go" | "java" | "c"
        | "cpp" | "cc" | "h" | "hpp" | "cs" | "rb" | "php" | "html" | "htm" | "css"
        | "scss" | "sass" | "less" | "json" | "xml" | "yaml" | "yml" | "toml" | "sh"
        | "bash" | "ps1" | "bat" | "cmd" | "lua" | "swift" | "kt" | "dart" | "sql"
        | "md" | "vue" | "svelte" => "code",
        "exe" | "dll" | "sys" | "msi" | "msix" | "appx" => "executable",
        _ => "other",
    }
}

// Flat entry collected during Phase 1 traversal
struct RawEntry {
    path: PathBuf,
    name: String,
    size: u64,
    is_dir: bool,
    file_type: &'static str,
    depth: usize,
}

/// Scan the drive and return the full in-memory tree + summary.
pub fn scan_drive(
    root_path: &str,
    app: AppHandle,
    cancel: Arc<AtomicBool>,
) -> Option<(DirNode, ScanSummary)> {
    let counter = AtomicU64::new(0);
    let root = PathBuf::from(root_path);

    // ── Phase 1: parallel traversal ──────────────────────────────────────────
    let raw_entries: Vec<RawEntry> = WalkDir::new(root_path)
        .parallelism(Parallelism::RayonNewPool(0))
        .skip_hidden(false)
        .max_depth(512)
        .process_read_dir(|_, _, _, children| {
            children.retain(|entry_result| {
                let Ok(entry) = entry_result else { return true };
                if !entry.file_type().is_dir() {
                    return true;
                }
                let name = entry.file_name().to_string_lossy();
                !SKIP_DIRS.contains(&name.as_ref())
            });
        })
        .into_iter()
        .filter_map(|result| {
            if cancel.load(Ordering::Relaxed) {
                return None;
            }
            let entry = result.ok()?;
            let ft = entry.file_type();

            if ft.is_symlink() {
                return None;
            }

            let path = entry.path();
            let name = entry.file_name().to_string_lossy().into_owned();
            let depth = entry.depth();

            if ft.is_dir() {
                Some(RawEntry {
                    path,
                    name,
                    size: 0,
                    is_dir: true,
                    file_type: "folder",
                    depth,
                })
            } else if ft.is_file() {
                let size = entry.metadata().ok()?.len();

                let cnt = counter.fetch_add(1, Ordering::Relaxed);
                if cnt % 5000 == 0 {
                    let _ = app.emit(
                        "scan-progress",
                        ScanProgress {
                            files_scanned: cnt,
                            current_path: path
                                .parent()
                                .unwrap_or(&path)
                                .to_string_lossy()
                                .into_owned(),
                        },
                    );
                }

                let file_type = categorize_extension(
                    path.extension().and_then(|e| e.to_str()).unwrap_or(""),
                );
                Some(RawEntry {
                    path,
                    name,
                    size,
                    is_dir: false,
                    file_type,
                    depth,
                })
            } else {
                None
            }
        })
        .collect();

    if cancel.load(Ordering::Relaxed) || raw_entries.is_empty() {
        return None;
    }

    let file_count = counter.load(Ordering::Relaxed);

    // ── Phase 2: build tree from flat list ───────────────────────────────────
    let mut nodes: HashMap<PathBuf, DirNode> =
        HashMap::with_capacity(raw_entries.len());

    for entry in &raw_entries {
        nodes.insert(
            entry.path.clone(),
            DirNode {
                name: entry.name.clone(),
                path: entry.path.to_string_lossy().into_owned(),
                size: entry.size,
                is_dir: entry.is_dir,
                file_type: entry.file_type.to_string(),
                children: vec![],
            },
        );
    }

    let mut sorted = raw_entries;
    sorted.par_sort_unstable_by(|a, b| b.depth.cmp(&a.depth));

    for entry in &sorted {
        if entry.path == root {
            continue;
        }
        let Some(parent_path) = entry.path.parent() else {
            continue;
        };
        let Some(child) = nodes.remove(&entry.path) else {
            continue;
        };
        if let Some(parent) = nodes.get_mut(parent_path) {
            parent.size += child.size;
            parent.children.push(child);
        }
    }

    let tree = nodes.remove(&root)?;

    let summary = ScanSummary {
        name: tree.name.clone(),
        path: tree.path.clone(),
        size: tree.size,
        file_count,
    };

    Some((tree, summary))
}

/// Look up a node's direct children by path.
/// Returns lightweight `DirEntry` structs (no nested children) to keep IPC fast.
pub fn get_children(tree: &DirNode, target_path: &str) -> Vec<DirEntry> {
    // If this IS the target, return its children
    if tree.path == target_path {
        return tree
            .children
            .iter()
            .map(|c| DirEntry {
                name: c.name.clone(),
                path: c.path.clone(),
                size: c.size,
                is_dir: c.is_dir,
                file_type: c.file_type.clone(),
                child_count: c.children.len(),
            })
            .collect();
    }

    // Only recurse into directories whose path is a prefix of target
    for child in &tree.children {
        if child.is_dir && target_path.starts_with(&child.path) {
            let result = get_children(child, target_path);
            if !result.is_empty() {
                return result;
            }
        }
    }

    vec![]
}
