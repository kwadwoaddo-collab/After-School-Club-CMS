import * as React from "react"
import { cn } from "@/lib/utils"

export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode
  error?: React.ReactNode
  helpText?: React.ReactNode
}

export function Field({
  label,
  error,
  helpText,
  children,
  className,
  ...props
}: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)} {...props}>
      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-error font-medium mt-1">{error}</p>}
      {helpText && !error && (
        <p className="text-xs text-muted-foreground mt-1">{helpText}</p>
      )}
    </div>
  )
}
