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
          'focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'read-only:opacity-70 read-only:cursor-default',
          'aria-[invalid=true]:border-danger aria-[invalid=true]:focus:outline-danger',
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
