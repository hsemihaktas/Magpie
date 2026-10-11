export default function FeedLoading() {
  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 flex gap-8 items-start">
      {/* Sidebar skeleton */}
      <div className="w-48 shrink-0 space-y-8">
        <div className="space-y-3">
          <div className="h-3 w-24 bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-6 bg-zinc-100 dark:bg-zinc-900 animate-pulse"
                style={{ width: `${60 + Math.random() * 40}%` }}
              />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-5 bg-zinc-100 dark:bg-zinc-900 animate-pulse"
                style={{ width: `${50 + Math.random() * 30}%` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        {/* Platform filter skeleton */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
          <div className="flex items-center gap-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-4 bg-zinc-200 dark:bg-zinc-800 animate-pulse"
                style={{ width: `${50 + i * 10}px` }}
              />
            ))}
          </div>
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="archive-card overflow-hidden"
            >
              {/* Thumbnail */}
              <div className="aspect-square bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
              {/* Content */}
              <div className="p-3 space-y-2">
                <div className="h-3 w-16 bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
                <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
                <div className="h-3 w-3/4 bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
