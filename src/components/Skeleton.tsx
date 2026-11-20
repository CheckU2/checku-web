type SkeletonProps = {
  label?: string;
  variant?: "rows" | "cards" | "field" | "metrics";
  count?: number;
};

export default function Skeleton({ label = "Cargando información", variant = "rows", count = 3 }: SkeletonProps) {
  return <div className={`skeleton skeleton-${variant}`} role="status">
    <span className="sr-only">{label}</span>
    {Array.from({ length: count }, (_, index) => <div className="skeleton-item" key={index} aria-hidden="true">
      {variant !== "field" && <span className="skeleton-shape skeleton-symbol" />}
      <span className="skeleton-shape skeleton-line" />
      {variant !== "field" && <span className="skeleton-shape skeleton-line skeleton-short" />}
    </div>)}
  </div>;
}

export function SessionSkeleton() {
  return <main className="session-skeleton">
    <img src="/icon.png" alt="CheckU" width="48" height="48" />
    <Skeleton variant="cards" count={1} label="Comprobando sesión" />
  </main>;
}
