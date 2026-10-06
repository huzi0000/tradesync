import { cn } from '../../lib/utils';

type BadgeVariant = 'default' | 'success' | 'error' | 'warning' | 'info' | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-[#F3F0E9] text-[#1B2428] border-[#DEDCD5]',
  success: 'bg-[#EBF5F0] text-[#387B60] border-[#C5DDD4]',
  error: 'bg-[#FBF0ED] text-[#BA6249] border-[#EDCCC5]',
  warning: 'bg-[#FDF7EC] text-[#9B7B2B] border-[#EDE0C0]',
  info: 'bg-[#EEF3FA] text-[#3B6CA8] border-[#C8D8EE]',
  neutral: 'bg-[#F3F0E9] text-[#7D8A89] border-[#DEDCD5]',
};

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
