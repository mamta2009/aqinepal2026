import { cn } from "@/lib/utils/cn";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <article
      className={cn(
        "rounded-2xl border border-border bg-white p-6 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function CardKicker({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "mb-2 text-xs font-extrabold tracking-[0.12em] text-forest uppercase",
        className,
      )}
      {...props}
    />
  );
}
