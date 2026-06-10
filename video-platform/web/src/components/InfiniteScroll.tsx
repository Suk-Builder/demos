import { useEffect, useRef, useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface InfiniteScrollProps {
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  children: React.ReactNode;
}

export function useIntersectionObserver(
  callback: () => void,
  options?: IntersectionObserverInit
) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          callback();
        }
      });
    }, {
      rootMargin: '200px',
      threshold: 0,
      ...options,
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [callback, options]);

  return ref;
}

export default function InfiniteScroll({
  onLoadMore,
  hasMore,
  isLoading,
  children,
}: InfiniteScrollProps) {
  const [showLoader, setShowLoader] = useState(false);

  const handleIntersect = useCallback(() => {
    if (!isLoading && hasMore) {
      setShowLoader(true);
      onLoadMore();
    }
  }, [isLoading, hasMore, onLoadMore]);

  const sentinelRef = useIntersectionObserver(handleIntersect);

  // Reset showLoader when isLoading becomes false
  useEffect(() => {
    if (!isLoading) {
      setShowLoader(false);
    }
  }, [isLoading]);

  return (
    <>
      {children}
      {/* Loading sentinel */}
      <div ref={sentinelRef} className="col-span-full flex justify-center py-6">
        {(showLoader || isLoading) && hasMore && (
          <div className="flex items-center gap-2 text-[#9499a0]">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">加载中...</span>
          </div>
        )}
        {!hasMore && (
          <span className="text-sm text-[#9499a0]">没有更多内容了</span>
        )}
      </div>
    </>
  );
}
