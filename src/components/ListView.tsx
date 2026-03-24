import { DirEntry, FILE_TYPE_COLORS, FileType, formatSize } from '../types';
import './ListView.css';

interface Props {
  nodes: DirEntry[];
  parentSize: number;
  onNavigate: (node: DirEntry) => void;
  onContextMenu: (e: React.MouseEvent, node: DirEntry) => void;
}

const TYPE_ICONS: Record<FileType | string, string> = {
  folder: '▶',
  image: '⬜',
  video: '▶',
  audio: '♪',
  archive: '⬡',
  document: '▤',
  code: '⌥',
  executable: '⚙',
  other: '·',
};

function humanType(node: DirEntry): string {
  if (node.is_dir) return 'Folder';
  const map: Record<string, string> = {
    image: 'Image', video: 'Video', audio: 'Audio',
    archive: 'Archive', document: 'Document', code: 'Code',
    executable: 'Executable', other: 'File',
  };
  return map[node.file_type] ?? 'File';
}

export function ListView({ nodes, parentSize, onNavigate, onContextMenu }: Props) {
  if (nodes.length === 0) {
    return (
      <div className="list-view list-view--empty">
        <span>No items match the current filter.</span>
      </div>
    );
  }

  return (
    <div className="list-view">
      <div className="list-view__header">
        <span className="lv-col lv-col--name">Name</span>
        <span className="lv-col lv-col--size">Size</span>
        <span className="lv-col lv-col--type">Type</span>
        <span className="lv-col lv-col--bar">% of parent</span>
      </div>

      <div className="list-view__body">
        {nodes.map((node) => {
          const pct = parentSize > 0 ? (node.size / parentSize) * 100 : 0;
          const color = FILE_TYPE_COLORS[node.is_dir ? 'folder' : node.file_type as FileType] ?? '#7F8C8D';

          return (
            <div
              key={node.path}
              className={`lv-row ${node.is_dir ? 'lv-row--dir' : ''}`}
              onDoubleClick={() => node.is_dir && onNavigate(node)}
              onClick={() => node.is_dir && onNavigate(node)}
              onContextMenu={(e) => onContextMenu(e, node)}
            >
              <span className="lv-col lv-col--name">
                <span
                  className="lv-icon"
                  style={{ color }}
                >
                  {node.is_dir ? '▶' : TYPE_ICONS[node.file_type] ?? '·'}
                </span>
                <span className="lv-name" title={node.path}>
                  {node.name}
                </span>
              </span>

              <span className="lv-col lv-col--size">
                {formatSize(node.size)}
              </span>

              <span className="lv-col lv-col--type">
                <span
                  className="lv-type-dot"
                  style={{ background: color }}
                />
                {humanType(node)}
              </span>

              <span className="lv-col lv-col--bar">
                <span className="lv-bar-wrap">
                  <span
                    className="lv-bar"
                    style={{
                      width: `${Math.min(pct, 100)}%`,
                      background: color,
                    }}
                  />
                </span>
                <span className="lv-pct">{pct.toFixed(1)}%</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
