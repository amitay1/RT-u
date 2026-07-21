import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground/80",
          "transition-[color,background-color,border-color,box-shadow] duration-150 ease-out",
          "[&:not(:disabled):not([readonly]):hover]:border-ring/60",
          "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
          "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/20",
          "[&[readonly]]:cursor-default [&[readonly]]:bg-muted/40 [&[readonly]]:shadow-none",
          "disabled:cursor-not-allowed disabled:border-border disabled:bg-muted/60 disabled:text-muted-foreground disabled:shadow-none disabled:opacity-70",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
