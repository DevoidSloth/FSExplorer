import './Breadcrumb.css';

interface BreadcrumbEntry {
  name: string;
  path: string;
}

interface Props {
  crumbs: BreadcrumbEntry[];
  onNavigate: (index: number) => void;
}

export function Breadcrumb({ crumbs, onNavigate }: Props) {
  return (
    <div className="breadcrumb">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        const displayName = i === 0 ? crumb.name || crumb.path : crumb.name;
        return (
          <span key={crumb.path} className="breadcrumb__item">
            {i > 0 && <span className="breadcrumb__sep">›</span>}
            <button
              className={`breadcrumb__seg ${isLast ? 'active' : ''}`}
              onClick={() => onNavigate(i)}
              disabled={isLast}
            >
              {displayName}
            </button>
          </span>
        );
      })}
    </div>
  );
}
