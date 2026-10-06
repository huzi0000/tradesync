import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export function Skeleton({ className, width, height }: SkeletonProps) {
  return (
    <div
      className={cn('bg-[#E8E5DE] rounded animate-pulse', className)}
      style={{ width, height }}
    />
  );
}

export function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'}
          height="0.75rem"
        />
      ))}
    </div>
  );
}
