import { ScanProgress } from '../types';
import './ScanProgressView.css';

interface Props {
  progress: ScanProgress | null;
  drive: string;
  onCancel: () => void;
}

export function ScanProgressView({ progress, drive, onCancel }: Props) {
  const count = progress?.files_scanned ?? 0;
  const currentPath = progress?.current_path ?? 'Starting...';
  const truncatedPath = currentPath.length > 72
    ? '...' + currentPath.slice(-69)
    : currentPath;

  return (
    <div className="scan-progress">
      <div className="scan-progress__inner">
        <div className="scan-progress__icon">◈</div>
        <h2 className="scan-progress__drive">Scanning {drive}</h2>

        <div className="scan-progress__bar-outer">
          <div className="scan-progress__bar-inner" />
        </div>

        <div className="scan-progress__stats">
          <span className="scan-progress__count">
            {count.toLocaleString()} files scanned
          </span>
        </div>

        <div className="scan-progress__path" title={currentPath}>
          {truncatedPath}
        </div>

        <button className="scan-progress__cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
