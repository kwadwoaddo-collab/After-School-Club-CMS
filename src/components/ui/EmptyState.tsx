import * as React from "react"
import { cn } from "./utils"

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center bg-surface rounded-lg border border-border m-4",
        className
      )}
      {...props}
    >
      {icon && <div className="mb-4 text-text-muted">{icon}</div>}
      <h3 className="text-section-title text-text mb-2">{title}</h3>
      {description && (
        <div className="text-small-body text-text-secondary max-w-md mb-6">
          {description}
        </div>
      )}
      {action && <div>{action}</div>}
    </div>
  )
}
