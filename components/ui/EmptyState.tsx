import { cn } from '../../lib/utils';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
      {Icon && (
        <div className="w-10 h-10 rounded-full bg-[#F3F0E9] border border-[#DEDCD5] flex items-center justify-center mb-4">
          <Icon size={18} className="text-[#7D8A89]" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-[#1B2428] mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-[#7D8A89] max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
