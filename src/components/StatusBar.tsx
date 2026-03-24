import { formatSize } from '../types';
import './StatusBar.css';

interface Props {
  totalFiles: number;
  totalSize: number;
  currentSize: number;
  itemCount: number;
  drive: string;
}

export function StatusBar({ totalFiles, totalSize, currentSize, itemCount, drive }: Props) {
  return (
    <div className="status-bar">
      <span className="status-bar__item">
        <span className="status-bar__label">Drive</span>
        <span className="status-bar__val">{drive}</span>
      </span>
      <span className="status-bar__sep" />
      <span className="status-bar__item">
        <span className="status-bar__label">Total</span>
        <span className="status-bar__val">{formatSize(totalSize)}</span>
      </span>
      <span className="status-bar__sep" />
      <span className="status-bar__item">
        <span className="status-bar__label">Files scanned</span>
        <span className="status-bar__val">{totalFiles.toLocaleString()}</span>
      </span>
      <span className="status-bar__sep" />
      <span className="status-bar__item">
        <span className="status-bar__label">Current folder</span>
        <span className="status-bar__val">{formatSize(currentSize)}</span>
      </span>
      <span className="status-bar__sep" />
      <span className="status-bar__item">
        <span className="status-bar__label">Items shown</span>
        <span className="status-bar__val">{itemCount}</span>
      </span>
    </div>
  );
}
