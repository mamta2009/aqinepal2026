import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-extrabold transition-[background,color,transform,border-color] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-forest/25 disabled:pointer-events-none disabled:opacity-55 motion-safe:hover:-translate-y-0.5",
  {
    variants: {
      variant: {
        primary: "bg-forest text-white hover:bg-forest-dark",
        secondary:
          "border border-border-strong bg-white text-ink hover:border-forest hover:text-forest-dark",
        danger: "bg-alert-red text-white hover:bg-red-800",
        ghost: "text-forest hover:bg-forest/10",
      },
      size: {
        default: "min-h-11 px-5",
        sm: "min-h-10 px-4 text-xs",
        lg: "min-h-12 px-6 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export function ButtonLink({
  href,
  className,
  variant,
  size,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
} & VariantProps<typeof buttonVariants>) {
  return (
    <Link className={cn(buttonVariants({ variant, size }), className)} href={href}>
      {children}
    </Link>
  );
}

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
