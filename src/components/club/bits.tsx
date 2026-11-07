import { Car, Package, Store, Tag, UtensilsCrossed } from "lucide-react";
import { avatarHue, initials } from "@/lib/club";
import { cn } from "@/lib/utils";

export function Avatar({ id, name, size = 28 }: { id: string; name: string; size?: number }) {
  const hue = avatarHue(id);
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `oklch(0.88 0.07 ${hue})`,
        color: `oklch(0.32 0.08 ${hue})`,
      }}
    >
      {initials(name)}
    </span>
  );
}

export function CategoryIcon({ name, className }: { name?: string | null; className?: string }) {
  const n = (name ?? "").toLowerCase();
  const I = n.includes("food")
    ? UtensilsCrossed
    : n.includes("venue")
      ? Store
      : n.includes("travel")
        ? Car
        : n.includes("suppl")
          ? Package
          : Tag;
  return <I className={cn("size-4", className)} aria-hidden />;
}

export function Empty({ title, line }: { title: string; line: string }) {
  return (
    <div className="animate-fade-up py-14 text-center">
      <div className="font-display text-2xl">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{line}</p>
    </div>
  );
}
