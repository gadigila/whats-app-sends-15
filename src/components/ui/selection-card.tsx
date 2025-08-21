import * as React from "react"
import { cn } from "@/lib/utils"

export interface SelectionCardProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isSelected?: boolean
}

const SelectionCard = React.forwardRef<HTMLButtonElement, SelectionCardProps>(
  ({ className, isSelected = false, children, ...props }, ref) => {
    return (
      <button
        className={cn(
          "w-full px-6 py-0 text-right transition-all duration-200 h-11",
          "text-[15px] font-medium",
          "rounded-[50.71px]",
          "border-2",
          "flex items-center justify-center",
          isSelected 
            ? "border-blue-500 bg-blue-50 text-blue-700" 
            : "border-[#DEDDD5] bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    )
  }
)
SelectionCard.displayName = "SelectionCard"

export { SelectionCard }