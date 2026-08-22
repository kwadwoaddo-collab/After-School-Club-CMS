import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-page text-text-secondary border-border",
        success: "bg-success-soft text-emerald-700 dark:text-emerald-400 border-transparent",
        warning: "bg-warning-soft text-amber-700 dark:text-amber-400 border-transparent",
        error: "bg-danger-soft text-danger border-transparent",
        destructive: "bg-danger-soft text-danger border-transparent",
        info: "bg-info-soft text-blue-700 dark:text-blue-400 border-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
