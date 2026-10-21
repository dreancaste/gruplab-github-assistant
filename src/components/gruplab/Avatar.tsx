import { cn } from "@/lib/utils";
import { iniciales } from "@/lib/gruplab";

const PALETA = ["bg-primary text-primary-foreground", "bg-secondary text-secondary-foreground", "bg-sun text-sun-foreground", "bg-mint text-mint-foreground"];

export function colorDe(id?: string | null) {
  if (!id) return PALETA[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETA[h % PALETA.length];
}

export function Avatar({
  nombre,
  id,
  size = "md",
  className,
}: {
  nombre?: string | null;
  id?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const s = size === "sm" ? "h-7 w-7 text-[10px]" : size === "lg" ? "h-11 w-11 text-sm" : "h-9 w-9 text-xs";
  return (
    <span
      title={nombre ?? undefined}
      className={cn(
        "grid shrink-0 place-items-center rounded-full border-2 border-ink font-bold",
        s,
        colorDe(id),
        className,
      )}
    >
      {iniciales(nombre)}
    </span>
  );
}

export function AvatarStack({
  ids,
  perfiles,
  max = 4,
}: {
  ids: string[];
  perfiles: Record<string, { nombre: string } | undefined>;
  max?: number;
}) {
  const visibles = ids.slice(0, max);
  return (
    <div className="flex -space-x-2">
      {visibles.map((id) => (
        <Avatar key={id} id={id} nombre={perfiles[id]?.nombre} size="sm" />
      ))}
      {ids.length > max && (
        <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-ink bg-card text-[10px] font-bold">
          +{ids.length - max}
        </span>
      )}
    </div>
  );
}
