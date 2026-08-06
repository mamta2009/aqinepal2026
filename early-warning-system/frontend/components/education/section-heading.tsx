import { cn } from "@/lib/utils/cn";

export function SectionHeading({
  eyebrow,
  title,
  lede,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  align?: "left" | "center";
}) {
  return (
    <div
      className={cn(
        "max-w-3xl",
        align === "center" && "mx-auto text-center",
      )}
    >
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="section-title">{title}</h2>
      {lede ? <p className="section-lede mt-5">{lede}</p> : null}
    </div>
  );
}
