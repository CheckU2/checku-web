import Skeleton from "./Skeleton";

export default function AcademicCardSkeleton({ label }: { label: string }) {
  return <div className="checku-card-grid academic-card-grid" role="status">
    <span className="sr-only">{label}</span>
    {[1, 2, 3].map(index => <article key={index} className="checku-class-card academic-card academic-placeholder" aria-hidden="true">
      <div className="academic-card-top"><span className="skeleton-shape academic-placeholder-icon" /><span className="skeleton-shape academic-placeholder-pill" /></div>
      <span className="skeleton-shape academic-placeholder-title" />
      <span className="skeleton-shape academic-placeholder-subtitle" />
      <div className="academic-card-footer"><span className="skeleton-shape academic-placeholder-button" /></div>
    </article>)}
  </div>;
}

export function RosterSkeleton({ label }: { label: string }) {
  return <div className="roster-frame"><Skeleton label={label} count={4} /></div>;
}
