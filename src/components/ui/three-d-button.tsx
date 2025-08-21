import * as React from "react"
import { cn } from "@/lib/utils"

export interface ThreeDButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "neutral" | "destructive"
  size?: "default" | "sm" | "lg"
}

const ThreeDButton = React.forwardRef<HTMLButtonElement, ThreeDButtonProps>(
  ({ className, variant = "primary", size = "default", children, ...props }, ref) => {
    const sizeClasses = {
      default: "h-12 px-6 text-base",
      sm: "h-10 px-4 text-sm",
      lg: "h-14 px-8 text-lg"
    }

    return (
      <button
        className={cn(
          "pushable",
          "relative border-0 bg-transparent p-0 cursor-pointer outline-offset-4 transition-all duration-250 hover:brightness-110 select-none",
          "[&]:[-webkit-tap-highlight-color:transparent]",
          className
        )}
        ref={ref}
        {...props}
      >
        <span className={cn("shadow", variant)} />
        <span className={cn("edge", variant)} />
        <span className={cn(
          "front",
          variant,
          sizeClasses[size],
          "w-full flex items-center justify-center gap-2 relative rounded-full border border-black font-semibold will-change-transform"
        )}>
          {children}
        </span>
      </button>
    )
  }
)
ThreeDButton.displayName = "ThreeDButton"

export { ThreeDButton }