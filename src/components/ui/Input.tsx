import * as React from 'react';
import { cn } from './utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1 text-sm text-text',
          'placeholder:text-text-muted',
          'focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'read-only:opacity-70 read-only:cursor-default',
          'aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/40',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
