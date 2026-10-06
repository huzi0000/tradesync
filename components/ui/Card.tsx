import { cn } from '../../lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
  id?: string;
}

export function Card({ children, className, padding = true, id }: CardProps) {
  return (
    <div
      id={id}
      className={cn(
        'bg-white border border-[#DEDCD5] rounded-lg',
        padding && 'p-4 sm:p-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between pb-3 border-b border-[#DAD8D1] mb-4', className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn('text-sm font-semibold text-[#1B2428] tracking-tight', className)}>
      {children}
    </h3>
  );
}

export function CardMeta({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-xs text-[#7D8A89]', className)}>
      {children}
    </p>
  );
}
