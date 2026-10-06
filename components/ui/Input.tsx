import { cn } from '../../lib/utils';
import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>((
  { error, label, hint, className, ...props },
  ref
) => {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-[#1B2428]">{label}</label>
      )}
      <input
        ref={ref}
        className={cn(
          'w-full h-9 px-3 text-sm text-[#1B2428] bg-white border rounded placeholder:text-[#7D8A89] focus:outline-none focus:ring-1 focus:border-[#1B2428] transition-colors',
          error ? 'border-[#BA6249] focus:ring-[#BA6249]' : 'border-[#DEDCD5] focus:ring-[#1B2428]',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-[#BA6249]">{error}</p>}
      {hint && !error && <p className="text-xs text-[#7D8A89]">{hint}</p>}
    </div>
  );
});

Input.displayName = 'Input';
