export function PageLoader({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="spinner" />
      {message && <span className="ml-3 text-[var(--meta)] text-sm">{message}</span>}
    </div>
  );
}

export function PageError({ message }: { message: string }) {
  return (
    <div className="bg-[color-mix(in_oklch,var(--danger)_10%,transparent)] border border-[color-mix(in_oklch,var(--danger)_20%,transparent)] rounded-[var(--radius-md)] p-4 text-[var(--danger)] text-sm">
      {message}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[var(--surface-warm)] ${className ?? ''}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="stat-card overflow-hidden">
            <div className="flex">
              <Skeleton className="w-1 h-20 rounded-l-[var(--radius-md)]" />
              <div className="p-5 pl-4 flex-1">
                <Skeleton className="h-3 w-16 mb-2" />
                <Skeleton className="h-8 w-12" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-[300px] rounded-[var(--radius-md)]" />
      <Skeleton className="h-[300px] rounded-[var(--radius-md)]" />
    </div>
  );
}

export function RulesSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-48 mt-2" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 flex-1 max-w-sm rounded-[var(--radius-sm)]" />
        <Skeleton className="h-9 w-32 rounded-[var(--radius-sm)]" />
      </div>
      <Skeleton className="h-48 rounded-[var(--radius-md)]" />
      <Skeleton className="h-48 rounded-[var(--radius-md)]" />
      <Skeleton className="h-48 rounded-[var(--radius-md)]" />
    </div>
  );
}

export function SessionsSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-64 rounded-[var(--radius-sm)]" />
        <Skeleton className="h-7 w-12 rounded-[var(--radius-sm)]" />
        <Skeleton className="h-7 w-12 rounded-[var(--radius-sm)]" />
        <Skeleton className="h-7 w-12 rounded-[var(--radius-sm)]" />
      </div>
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)] last:border-0">
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HistorySkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="relative pl-8 space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-4 w-28 mb-3" />
            <Skeleton className="h-16 rounded-[var(--radius-md)] ml-4" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SessionDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-48" />
      <div className="panel space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      </div>
      <Skeleton className="h-[300px] rounded-[var(--radius-md)]" />
    </div>
  );
}

export function RuleDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-64" />
      <div className="panel space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 pt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center">
              <Skeleton className="h-3 w-16 mb-2" />
              <Skeleton className="h-6 w-12 mb-1" />
              <Skeleton className="h-2 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="h-[200px] rounded-[var(--radius-md)]" />
      <Skeleton className="h-[300px] rounded-[var(--radius-md)]" />
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <Skeleton className="h-7 w-48 rounded-[var(--radius-sm)]" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="stat-card overflow-hidden">
            <div className="flex"><Skeleton className="w-1 h-16 rounded-l-[var(--radius-md)]" /><div className="p-5 pl-4 flex-1"><Skeleton className="h-3 w-14 mb-2" /><Skeleton className="h-6 w-10" /></div></div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-[360px] rounded-[var(--radius-md)]" />
        <Skeleton className="h-[360px] rounded-[var(--radius-md)]" />
      </div>
    </div>
  );
}
