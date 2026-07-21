import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded border border-input bg-background text-primary-foreground shadow-sm ring-offset-background",
      "transition-[color,background-color,border-color,box-shadow] duration-150",
      "data-[state=unchecked]:hover:border-ring data-[state=unchecked]:hover:bg-accent/50",
      "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:hover:border-primary-hover data-[state=checked]:hover:bg-primary-hover",
      "data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2",
      "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/20",
      "disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:opacity-60 disabled:shadow-none",
      "data-[state=unchecked]:disabled:hover:border-border data-[state=unchecked]:disabled:hover:bg-muted data-[state=checked]:disabled:hover:border-primary data-[state=checked]:disabled:hover:bg-primary",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
