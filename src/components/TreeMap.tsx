import { useEffect, useRef, useState, useCallback } from 'react';
import { hierarchy, treemap, treemapSquarify, HierarchyRectangularNode } from 'd3-hierarchy';
import { DirEntry, FILE_TYPE_COLORS, FileType, formatSize } from '../types';
import './TreeMap.css';

interface Props {
  nodes: DirEntry[];
  parentSize: number;
  onNavigate: (node: DirEntry) => void;
  onContextMenu: (e: React.MouseEvent, node: DirEntry) => void;
}

interface Tooltip {
  x: number;
  y: number;
  node: DirEntry;
  pct: number;
}

interface TileData {
  node: DirEntry;
  x0: number; y0: number; x1: number; y1: number;
}

type TreeNode = { name: string; size: number; is_dir: boolean; file_type: string; path: string; children?: TreeNode[] };

export function TreeMap({ nodes, parentSize, onNavigate, onContextMenu }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tiles, setTiles] = useState<TileData[]>([]);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const computeTiles = useCallback(() => {
    if (!containerRef.current || nodes.length === 0) {
      setTiles([]);
      return;
    }
    const { width, height } = containerRef.current.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    // Flat list as leaves (strip children so d3 treats them as leaves)
    const flatNodes: TreeNode[] = nodes.map(n => ({
      name: n.name,
      size: n.size,
      is_dir: n.is_dir,
      file_type: n.file_type,
      path: n.path,
    }));

    const syntheticRoot: TreeNode = {
      name: '__root__',
      size: 0,
      is_dir: true,
      file_type: 'folder',
      path: '',
      children: flatNodes,
    };

    const root = hierarchy<TreeNode>(syntheticRoot, d => d.children)
      .sum(d => d.children ? 0 : (d.size ?? 0))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const layout = treemap<TreeNode>()
      .size([width, height])
      .tile(treemapSquarify.ratio(1.4))
      .paddingInner(2)
      .paddingOuter(0)
      .round(true);

    const rootRect = layout(root) as HierarchyRectangularNode<TreeNode>;

    const result: TileData[] = [];
    for (const leaf of rootRect.leaves()) {
      const d = leaf.data;
      const original = nodes.find(n => n.path === d.path);
      if (!original) continue;
      result.push({
        node: original,
        x0: leaf.x0,
        y0: leaf.y0,
        x1: leaf.x1,
        y1: leaf.y1,
      });
    }
    setTiles(result);
  }, [nodes]);

  useEffect(() => {
    computeTiles();
    const observer = new ResizeObserver(computeTiles);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [computeTiles]);

  return (
    <div className="treemap" ref={containerRef}>
      {tiles.map(({ node, x0, y0, x1, y1 }) => {
        const w = x1 - x0;
        const h = y1 - y0;
        if (w < 4 || h < 4) return null;

        const color = FILE_TYPE_COLORS[node.is_dir ? 'folder' : node.file_type as FileType] ?? '#7F8C8D';
        const pct = parentSize > 0 ? (node.size / parentSize) * 100 : 0;
        const showLabel = w > 60 && h > 30;
        const showSize = w > 80 && h > 50;

        return (
          <div
            key={node.path}
            className={`treemap__tile ${node.is_dir ? 'treemap__tile--dir' : ''}`}
            style={{
              left: x0,
              top: y0,
              width: w,
              height: h,
              '--tile-color': color,
            } as React.CSSProperties}
            onClick={() => node.is_dir && onNavigate(node)}
            onContextMenu={(e) => onContextMenu(e, node)}
            onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, node, pct })}
            onMouseMove={(e) => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
            onMouseLeave={() => setTooltip(null)}
          >
            {showLabel && (
              <div className="treemap__tile-content">
                <span className="treemap__tile-name">{node.name}</span>
                {showSize && (
                  <span className="treemap__tile-size">{formatSize(node.size)}</span>
                )}
              </div>
            )}
          </div>
        );
      })}

      {tooltip && (
        <div
          className="treemap__tooltip"
          style={{
            left: Math.min(tooltip.x + 14, window.innerWidth - 220),
            top: Math.min(tooltip.y + 14, window.innerHeight - 100),
          }}
        >
          <div className="treemap__tooltip-name">{tooltip.node.name}</div>
          <div className="treemap__tooltip-size">{formatSize(tooltip.node.size)}</div>
          <div className="treemap__tooltip-pct">{tooltip.pct.toFixed(1)}% of parent</div>
          {tooltip.node.is_dir && (
            <div className="treemap__tooltip-hint">Click to open</div>
          )}
        </div>
      )}
    </div>
  );
}
