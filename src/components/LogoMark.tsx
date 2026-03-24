interface Props {
  size?: number;
  className?: string;
}

/**
 * FSExplorer logo mark — a squarified treemap in a rounded square.
 * Tile opacity encodes relative size, matching the app's core metaphor.
 */
export function LogoMark({ size = 48, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Container */}
      <rect width="48" height="48" rx="10" fill="#0D0F1A" />

      {/* Large tile — dominant item */}
      <rect x="3" y="3" width="22" height="22" rx="3" fill="#C0FF44" />

      {/* Right column — two stacked medium tiles */}
      <rect x="27" y="3"  width="18" height="10" rx="2" fill="#C0FF44" fillOpacity="0.55" />
      <rect x="27" y="15" width="18" height="10" rx="2" fill="#C0FF44" fillOpacity="0.30" />

      {/* Bottom row — three small tiles */}
      <rect x="3"  y="27" width="10" height="18" rx="2" fill="#C0FF44" fillOpacity="0.65" />
      <rect x="15" y="27" width="10" height="18" rx="2" fill="#C0FF44" fillOpacity="0.38" />
      <rect x="27" y="27" width="18" height="18" rx="2" fill="#C0FF44" fillOpacity="0.18" />
    </svg>
  );
}
