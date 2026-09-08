import * as React from 'react';
import { cn } from './utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text',
          'placeholder:text-text-muted',
          'focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'read-only:opacity-70 read-only:cursor-default',
          'aria-[invalid=true]:border-danger aria-[invalid=true]:focus:outline-danger',
          'resize-y',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
