import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-secondary text-muted-foreground border-border",
        success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
        warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
        error: "bg-error/10 text-error border-error/20",
        destructive: "bg-destructive/10 text-destructive border-destructive/20",
        info: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
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
