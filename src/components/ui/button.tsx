import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent text-sm font-medium",
    "ring-offset-background transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:translate-y-0 aria-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    "active:translate-y-px active:duration-75",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground shadow-[inset_0_1px_0_hsl(var(--primary-foreground)/0.16),0_1px_3px_hsl(var(--primary)/0.35)] hover:border-primary-hover hover:bg-primary-hover active:bg-primary-hover/90 active:shadow-[inset_0_1px_2px_hsl(var(--primary-foreground)/0.1)]",
        destructive:
          "border-destructive bg-destructive text-destructive-foreground shadow-[inset_0_1px_0_hsl(var(--destructive-foreground)/0.14),0_1px_3px_hsl(var(--destructive)/0.3)] hover:bg-destructive/90 active:bg-destructive/80",
        outline:
          "border-input bg-background text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04),var(--shadow-sm)] hover:border-ring/50 hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
        secondary:
          "border-border bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 active:bg-secondary/70",
        ghost:
          "text-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/75",
        link:
          "text-primary underline-offset-4 hover:text-primary-hover hover:underline active:translate-y-0",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3",
        lg: "h-10 px-5",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

// The variant builder is part of the shadcn component's styling API.
// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants };
