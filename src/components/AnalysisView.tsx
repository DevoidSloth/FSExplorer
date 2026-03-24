import { useState, useMemo, useCallback, useEffect } from 'react';
import { DirEntry, DriveInfo, FileType, SortField, SortDir, ViewMode, ScanSummary } from '../types';
import { Toolbar } from './Toolbar';
import { Breadcrumb } from './Breadcrumb';
import { ListView } from './ListView';
import { TreeMap } from './TreeMap';
import { StatusBar } from './StatusBar';
import { ContextMenu } from './ContextMenu';
import './AnalysisView.css';

/** Breadcrumb entry — just the info we need, no children payload. */
interface BreadcrumbEntry {
  name: string;
  path: string;
  size: number;
}

interface Props {
  summary: ScanSummary;
  drive: string;
  drives: DriveInfo[];
  fetchChildren: (path: string) => Promise<DirEntry[]>;
  onRescan: () => void;
  onChangeDrive: () => void;
}

export interface CtxMenuState {
  x: number;
  y: number;
  node: DirEntry;
}

export function AnalysisView({ summary, drive, drives, fetchChildren, onRescan, onChangeDrive }: Props) {
  const [view, setView] = useState<ViewMode>('list');
  const [typeFilter, setTypeFilter] = useState<FileType | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('size');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([
    { name: summary.name, path: summary.path, size: summary.size },
  ]);
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);
  const [children, setChildren] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const currentCrumb = breadcrumb[breadcrumb.length - 1];
  const driveInfo = drives.find(d => d.letter === drive);

  // Fetch children whenever the current path changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchChildren(currentCrumb.path).then(result => {
      if (!cancelled) {
        setChildren(result);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setChildren([]);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [currentCrumb.path, fetchChildren]);

  const navigateTo = useCallback((node: DirEntry) => {
    if (!node.is_dir) return;
    setBreadcrumb(prev => {
      const idx = prev.findIndex(n => n.path === node.path);
      if (idx !== -1) return prev.slice(0, idx + 1);
      return [...prev, { name: node.name, path: node.path, size: node.size }];
    });
    setCtxMenu(null);
  }, []);

  const navigateToBreadcrumb = useCallback((index: number) => {
    setBreadcrumb(prev => prev.slice(0, index + 1));
    setCtxMenu(null);
  }, []);

  const openContextMenu = useCallback((e: React.MouseEvent, node: DirEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  const closeContextMenu = useCallback(() => setCtxMenu(null), []);

  const sortedChildren = useMemo(() => {
    let items = [...children];

    if (typeFilter !== 'all') {
      if (typeFilter === 'folder') {
        items = items.filter(c => c.is_dir);
      } else {
        items = items.filter(c => !c.is_dir && c.file_type === typeFilter);
      }
    }

    items.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'size') cmp = b.size - a.size;
      else if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'type') cmp = a.file_type.localeCompare(b.file_type);

      if (sortField === 'size') {
        if (a.is_dir && !b.is_dir) cmp = -1;
        else if (!a.is_dir && b.is_dir) cmp = 1;
      }

      return sortDir === 'asc' ? -cmp : cmp;
    });

    return items;
  }, [children, typeFilter, sortField, sortDir]);

  return (
    <div className="analysis" onClick={closeContextMenu}>
      <Toolbar
        drive={drive}
        driveInfo={driveInfo}
        view={view}
        typeFilter={typeFilter}
        sortField={sortField}
        sortDir={sortDir}
        onViewChange={setView}
        onTypeFilter={setTypeFilter}
        onSortField={setSortField}
        onSortDir={setSortDir}
        onRescan={onRescan}
        onChangeDrive={onChangeDrive}
      />

      <Breadcrumb
        crumbs={breadcrumb}
        onNavigate={navigateToBreadcrumb}
      />

      <div className="analysis__content">
        {loading ? (
          <div className="analysis__loading">Loading…</div>
        ) : view === 'list' ? (
          <ListView
            nodes={sortedChildren}
            parentSize={currentCrumb.size}
            onNavigate={navigateTo}
            onContextMenu={openContextMenu}
          />
        ) : (
          <TreeMap
            nodes={sortedChildren}
            parentSize={currentCrumb.size}
            onNavigate={navigateTo}
            onContextMenu={openContextMenu}
          />
        )}
      </div>

      <StatusBar
        totalFiles={summary.file_count}
        totalSize={summary.size}
        currentSize={currentCrumb.size}
        itemCount={sortedChildren.length}
        drive={drive}
      />

      {ctxMenu && (
        <ContextMenu
          state={ctxMenu}
          onClose={closeContextMenu}
          onNavigate={navigateTo}
        />
      )}
    </div>
  );
}
