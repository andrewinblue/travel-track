function Pulse({ className }: { className?: string }) {
  return <div className={`bg-gray-800 animate-pulse rounded-lg ${className ?? ''}`} />;
}

export function TripCardSkeleton() {
  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      <Pulse className="h-40 rounded-none" />
      <div className="p-4">
        <Pulse className="h-5 w-3/4 mb-2" />
        <Pulse className="h-4 w-1/2 mb-3" />
        <div className="flex items-center justify-between">
          <Pulse className="h-3.5 w-2/5" />
          <Pulse className="h-3.5 w-1/5" />
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center">
            <Pulse className="h-8 w-16 mx-auto mb-2" />
            <Pulse className="h-3.5 w-20 mx-auto" />
          </div>
        ))}
      </div>
      {/* Page title row */}
      <div className="flex items-center justify-between mb-5">
        <Pulse className="h-7 w-24" />
        <Pulse className="h-9 w-28" />
      </div>
      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <TripCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function TripPageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Hero card */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden mb-8">
        <Pulse className="h-52 rounded-none" />
        <div className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 mr-4">
              <Pulse className="h-8 w-2/3 mb-2" />
              <Pulse className="h-4 w-40" />
            </div>
            <Pulse className="h-7 w-20 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-4 mt-3">
            <Pulse className="h-4 w-52" />
            <Pulse className="h-4 w-16" />
            <Pulse className="h-4 w-24" />
          </div>
        </div>
      </div>
      {/* Widget placeholders */}
      <Pulse className="h-40 mb-8" />
      <Pulse className="h-60 mb-8" />
      <Pulse className="h-52 mb-8" />
    </div>
  );
}
