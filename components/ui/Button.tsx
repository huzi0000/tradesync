import { cn } from '../../lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-[#1B2428] text-white border-[#1B2428] hover:bg-[#2C3A40]',
  secondary: 'bg-[#BA6249] text-white border-[#BA6249] hover:bg-[#A5553E]',
  ghost: 'bg-transparent text-[#1B2428] border-transparent hover:bg-[#E8E5DE]',
  destructive: 'bg-[#BA6249] text-white border-[#BA6249] hover:bg-[#A5553E]',
  outline: 'bg-white text-[#1B2428] border-[#DEDCD5] hover:bg-[#F3F0E9]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-7 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-11 px-6 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>((
  { variant = 'primary', size = 'md', loading = false, children, className, disabled, ...props },
  ref
) => {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium border rounded transition-colors duration-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1B2428] focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
});

Button.displayName = 'Button';
