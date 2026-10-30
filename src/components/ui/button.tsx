import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const variants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors duration-200 disabled:pointer-events-none disabled:opacity-40 min-h-11",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg hover:bg-primary/90",
        surface: "border border-border bg-surface text-fg hover:bg-surface-2",
        ghost: "bg-transparent text-fg hover:bg-surface-2",
        danger: "border border-danger/40 bg-transparent text-danger hover:bg-danger/10",
      },
      full: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "surface", full: false },
  },
);

export function Button({
  className,
  variant,
  full,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof variants>) {
  return <button type={type} className={cn(variants({ variant, full }), className)} {...props} />;
}
