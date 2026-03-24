import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DirEntry } from '../types';
import { CtxMenuState } from './AnalysisView';
import './ContextMenu.css';

interface Props {
  state: CtxMenuState;
  onClose: () => void;
  onNavigate: (node: DirEntry) => void;
}

export function ContextMenu({ state, onClose, onNavigate }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Adjust position to stay in viewport
  const menuW = 200;
  const menuH = state.node.is_dir ? 120 : 90;
  const x = Math.min(state.x, window.innerWidth - menuW - 8);
  const y = Math.min(state.y, window.innerHeight - menuH - 8);

  const handleOpenExplorer = async () => {
    await invoke('open_in_explorer', { path: state.node.path });
    onClose();
  };

  const handleCopyPath = async () => {
    await navigator.clipboard.writeText(state.node.path);
    onClose();
  };

  const handleDelete = async () => {
    const label = state.node.name;
    const msg = state.node.is_dir
      ? `Permanently delete "${label}" and all its contents? This cannot be undone.`
      : `Permanently delete "${label}"? This cannot be undone.`;

    if (window.confirm(msg)) {
      try {
        await invoke('delete_path', {
          path: state.node.path,
          isDir: state.node.is_dir,
        });
      } catch (e) {
        alert(`Delete failed: ${e}`);
      }
    }
    onClose();
  };

  return (
    <div
      ref={ref}
      className="ctx-menu"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="ctx-menu__header">
        <span className="ctx-menu__name" title={state.node.path}>
          {state.node.name}
        </span>
      </div>

      {state.node.is_dir && (
        <button className="ctx-menu__item" onClick={() => { onNavigate(state.node); onClose(); }}>
          <span className="ctx-menu__icon">▶</span>
          Open
        </button>
      )}

      <button className="ctx-menu__item" onClick={handleOpenExplorer}>
        <span className="ctx-menu__icon">⬚</span>
        Show in Explorer
      </button>

      <button className="ctx-menu__item" onClick={handleCopyPath}>
        <span className="ctx-menu__icon">⎘</span>
        Copy Path
      </button>

      <div className="ctx-menu__divider" />

      <button className="ctx-menu__item ctx-menu__item--danger" onClick={handleDelete}>
        <span className="ctx-menu__icon">✕</span>
        Delete
      </button>
    </div>
  );
}
