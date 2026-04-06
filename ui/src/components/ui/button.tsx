import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none cursor-pointer border",
  {
    variants: {
      variant: {
        default: "bg-[color:var(--vscode-button-background)] text-[color:var(--vscode-button-foreground)] hover:bg-[color:var(--vscode-button-hoverBackground)] border-[color:var(--vscode-button-border,transparent)]",
        destructive:
          "bg-[color:var(--vscode-button-background)] text-[color:var(--vscode-button-foreground)] hover:bg-[color:var(--vscode-button-hoverBackground)] border-[color:var(--vscode-button-border,transparent)]",
        outline:
          "bg-[color:var(--vscode-button-secondaryBackground)] text-[color:var(--vscode-button-secondaryForeground)] hover:bg-[color:var(--vscode-button-secondaryHoverBackground)] border-[color:var(--vscode-button-secondaryBorder,var(--vscode-button-border,transparent))]",
        secondary:
          "bg-[color:var(--vscode-button-secondaryBackground)] text-[color:var(--vscode-button-secondaryForeground)] hover:bg-[color:var(--vscode-button-secondaryHoverBackground)] border-[color:var(--vscode-button-secondaryBorder,var(--vscode-button-border,transparent))]",
        ghost:
          "bg-transparent text-[color:var(--vscode-foreground)] hover:bg-[color:var(--vscode-list-hoverBackground)] border-transparent",
        link: "text-[color:var(--vscode-textLink-foreground)] underline-offset-4 hover:underline border-transparent",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
