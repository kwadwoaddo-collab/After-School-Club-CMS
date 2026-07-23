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
        "flex flex-col items-center justify-center p-8 text-center bg-card rounded-[24px] border border-border shadow-sm m-4",
        className
      )}
      {...props}
    >
      {icon && <div className="mb-4 text-muted-foreground">{icon}</div>}
      <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
      {description && (
        <div className="text-muted-foreground text-sm max-w-md mb-6">
          {description}
        </div>
      )}
      {action && <div>{action}</div>}
    </div>
  )
}
