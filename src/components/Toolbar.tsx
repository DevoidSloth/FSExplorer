import { DriveInfo, FileType, SortDir, SortField, ViewMode, FILE_TYPE_LABELS, formatSize } from '../types';
import './Toolbar.css';

interface Props {
  drive: string;
  driveInfo?: DriveInfo;
  view: ViewMode;
  typeFilter: FileType | 'all';
  sortField: SortField;
  sortDir: SortDir;
  onViewChange: (v: ViewMode) => void;
  onTypeFilter: (f: FileType | 'all') => void;
  onSortField: (f: SortField) => void;
  onSortDir: (d: SortDir) => void;
  onRescan: () => void;
  onChangeDrive: () => void;
}

const FILE_TYPES: Array<FileType | 'all'> = [
  'all', 'folder', 'image', 'video', 'audio', 'archive', 'document', 'code', 'executable', 'other'
];

export function Toolbar({
  drive, driveInfo, view, typeFilter, sortField, sortDir,
  onViewChange, onTypeFilter, onSortField, onSortDir, onRescan, onChangeDrive
}: Props) {
  const used = driveInfo ? driveInfo.total - driveInfo.free : 0;
  const usedPct = driveInfo && driveInfo.total > 0
    ? ((used / driveInfo.total) * 100).toFixed(0)
    : '?';

  return (
    <div className="toolbar">
      <div className="toolbar__left">
        <button className="toolbar__back" onClick={onChangeDrive} title="Choose drive">
          ◈
        </button>

        <div className="toolbar__drive">
          <span className="toolbar__drive-letter">{drive}</span>
          {driveInfo && (
            <span className="toolbar__drive-info">
              {formatSize(used)} / {formatSize(driveInfo.total)} · {usedPct}% used
            </span>
          )}
        </div>
      </div>

      <div className="toolbar__center">
        <div className="toolbar__group">
          <label className="toolbar__label">Type</label>
          <select
            className="toolbar__select"
            value={typeFilter}
            onChange={e => onTypeFilter(e.target.value as FileType | 'all')}
          >
            <option value="all">All</option>
            {FILE_TYPES.filter(t => t !== 'all').map(t => (
              <option key={t} value={t}>{FILE_TYPE_LABELS[t as FileType]}</option>
            ))}
          </select>
        </div>

        <div className="toolbar__group">
          <label className="toolbar__label">Sort</label>
          <select
            className="toolbar__select"
            value={sortField}
            onChange={e => onSortField(e.target.value as SortField)}
          >
            <option value="size">Size</option>
            <option value="name">Name</option>
            <option value="type">Type</option>
          </select>
          <button
            className="toolbar__sort-dir"
            onClick={() => onSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
            title={sortDir === 'desc' ? 'Descending' : 'Ascending'}
          >
            {sortDir === 'desc' ? '↓' : '↑'}
          </button>
        </div>

        <div className="toolbar__view-toggle">
          <button
            className={`toolbar__view-btn ${view === 'list' ? 'active' : ''}`}
            onClick={() => onViewChange('list')}
            title="List view"
          >
            ≡
          </button>
          <button
            className={`toolbar__view-btn ${view === 'treemap' ? 'active' : ''}`}
            onClick={() => onViewChange('treemap')}
            title="Treemap view"
          >
            ⊞
          </button>
        </div>
      </div>

      <div className="toolbar__right">
        <button className="toolbar__rescan" onClick={onRescan}>
          ↻ Rescan
        </button>
      </div>
    </div>
  );
}
