import { cn } from "@/lib/utils/cn";

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full bg-sky-soft px-3 py-1 text-xs font-extrabold text-link",
        className,
      )}
      {...props}
    />
  );
}
