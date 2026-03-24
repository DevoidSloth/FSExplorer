import { DriveInfo, formatSize } from '../types';
import { LogoMark } from './LogoMark';
import './DrivePicker.css';

interface Props {
  drives: DriveInfo[];
  onScan: (drive: string) => void;
  error: string | null;
  loading: boolean;
}

export function DrivePicker({ drives, onScan, error, loading }: Props) {
  return (
    <div className="drive-picker">
      <div className="drive-picker__inner">
        <div className="drive-picker__logo">
          <LogoMark size={64} className="drive-picker__logomark" />
          <h1 className="drive-picker__title">FSExplorer</h1>
          <p className="drive-picker__subtitle">Disk Space Analyzer</p>
        </div>

        {loading && (
          <div className="drive-picker__loading">
            <span className="spinner" /> Detecting drives...
          </div>
        )}

        {error && (
          <div className="drive-picker__error">{error}</div>
        )}

        {!loading && drives.length === 0 && !error && (
          <div className="drive-picker__empty">No fixed drives detected.</div>
        )}

        <div className="drive-picker__grid">
          {drives.map((drive) => {
            const used = drive.total - drive.free;
            const usedPct = drive.total > 0 ? (used / drive.total) * 100 : 0;
            const critical = usedPct > 85;

            // On macOS, drive.letter is a path like "/" or "/Volumes/MyDrive".
            // Show label as the primary identifier and mount path as the subtitle.
            const isUnixPath = drive.letter.startsWith('/');
            const primary = isUnixPath ? (drive.label || drive.letter) : drive.letter;
            const secondary = isUnixPath ? drive.letter : drive.label;

            return (
              <button
                key={drive.letter}
                className={`drive-card ${critical ? 'drive-card--critical' : ''}`}
                onClick={() => onScan(drive.letter)}
              >
                <div className="drive-card__header">
                  <span className="drive-card__letter">{primary}</span>
                  {secondary && (
                    <span className="drive-card__label">{secondary}</span>
                  )}
                </div>

                <div className="drive-card__bar-wrap">
                  <div
                    className="drive-card__bar"
                    style={{ width: `${usedPct}%` }}
                  />
                </div>

                <div className="drive-card__stats">
                  <span className="drive-card__used">{formatSize(used)} used</span>
                  <span className="drive-card__pct">{usedPct.toFixed(0)}%</span>
                  <span className="drive-card__total">{formatSize(drive.total)}</span>
                </div>

                <div className="drive-card__free">
                  {formatSize(drive.free)} free
                </div>

                <div className="drive-card__cta">Analyze →</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
