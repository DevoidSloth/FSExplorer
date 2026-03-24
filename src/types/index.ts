export interface DirNode {
  name: string;
  path: string;
  size: number;
  is_dir: boolean;
  file_type: FileType;
  children: DirNode[];
}

/** Lightweight child entry returned by get_children (no nested children). */
export interface DirEntry {
  name: string;
  path: string;
  size: number;
  is_dir: boolean;
  file_type: FileType;
  child_count: number;
}

/** Root summary returned after a scan — no children payload. */
export interface ScanSummary {
  name: string;
  path: string;
  size: number;
  file_count: number;
}

export interface DriveInfo {
  letter: string;
  label: string;
  total: number;
  free: number;
}

export interface ScanProgress {
  files_scanned: number;
  current_path: string;
}

export type FileType =
  | 'folder'
  | 'image'
  | 'video'
  | 'audio'
  | 'archive'
  | 'document'
  | 'code'
  | 'executable'
  | 'other';

export type SortField = 'size' | 'name' | 'type';
export type SortDir = 'asc' | 'desc';
export type ViewMode = 'list' | 'treemap';

export interface FlatNode {
  node: DirNode;
  depth: number;
  parentPath: string;
}

export const FILE_TYPE_COLORS: Record<FileType, string> = {
  folder: '#4A90D9',
  image: '#E8855A',
  video: '#9B59B6',
  audio: '#1ABC9C',
  archive: '#F39C12',
  document: '#3498DB',
  code: '#2ECC71',
  executable: '#E74C3C',
  other: '#7F8C8D',
};

export const FILE_TYPE_LABELS: Record<FileType, string> = {
  folder: 'Folders',
  image: 'Images',
  video: 'Videos',
  audio: 'Audio',
  archive: 'Archives',
  document: 'Documents',
  code: 'Code',
  executable: 'Executables',
  other: 'Other',
};

export function formatSize(bytes: number): string {
  if (bytes >= 1099511627776) return `${(bytes / 1099511627776).toFixed(2)} TB`;
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}
