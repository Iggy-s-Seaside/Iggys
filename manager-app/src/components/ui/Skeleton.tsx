interface SkeletonProps {
  /** Extra classes — set height/width/shape here (e.g. "h-4 w-2/3 rounded-full"). */
  className?: string;
}

/** A single pulsing placeholder block. Shape it with className. */
export function Skeleton({ className }: SkeletonProps) {
  return <div className={`bg-surface-hover animate-pulse rounded ${className ?? ''}`} />;
}

interface ListSkeletonProps {
  /** How many placeholder rows to render (default 3). */
  rows?: number;
  /** Extra classes for the wrapping list. */
  className?: string;
}

/** A list of loading rows — a checkbox-ish square plus a line of text, like the To-Do widget. */
export function ListSkeleton({ rows = 3, className }: ListSkeletonProps) {
  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="w-5 h-5 shrink-0" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

interface CardSkeletonProps {
  /** Extra classes for the card wrapper. */
  className?: string;
}

/** A content-shaped card placeholder — title line, a couple of meta lines. */
export function CardSkeleton({ className }: CardSkeletonProps) {
  return (
    <div className={`card p-4 space-y-3 ${className ?? ''}`}>
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-12 shrink-0" />
      </div>
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}

export default Skeleton;
