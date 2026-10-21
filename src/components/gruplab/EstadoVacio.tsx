import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EstadoVacio({
  icon: Icon,
  titulo,
  texto,
  children,
}: {
  icon: LucideIcon;
  titulo: string;
  texto?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-ink/40 bg-card/60 px-6 py-12 text-center">
      <span className="brut-sm mx-auto grid h-12 w-12 place-items-center rounded-xl bg-muted">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-4 text-lg font-bold">{titulo}</h3>
      {texto && <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{texto}</p>}
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}
