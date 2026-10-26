import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { History } from "lucide-react";
import { ACCION_TEXTO, type Actividad, type Perfil } from "@/lib/gruplab";
import { Avatar } from "./Avatar";
import { EstadoVacio } from "./EstadoVacio";

const COLOR_ACCION: Record<string, string> = {
  crear: "bg-primary",
  mover: "bg-secondary",
  editar: "bg-muted",
  eliminar: "bg-destructive",
  puntuar: "bg-sun",
  adjuntar: "bg-mint",
  sumar_integrante: "bg-mint",
  quitar_integrante: "bg-muted",
  revisar: "bg-mint",
  reabrir: "bg-destructive",
};

function etiquetaDia(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return "Hoy";
  if (isYesterday(d)) return "Ayer";
  return format(d, "EEEE d 'de' MMMM", { locale: es });
}

export function ActividadFeed({
  actividad,
  perfiles,
  nombresGrupo,
}: {
  actividad: Actividad[];
  perfiles: Record<string, Perfil | undefined>;
  nombresGrupo?: Record<string, string> | undefined;
}) {
  if (actividad.length === 0) {
    return <EstadoVacio icon={History} titulo="Sin actividad todavía" texto="Cada vez que alguien cree, mueva o edite una tarea va a aparecer acá." />;
  }

  const grupos: { dia: string; items: Actividad[] }[] = [];
  for (const a of actividad) {
    const dia = etiquetaDia(a.created_at);
    const last = grupos[grupos.length - 1];
    if (last && last.dia === dia) last.items.push(a);
    else grupos.push({ dia, items: [a] });
  }

  return (
    <div className="brut rounded-2xl bg-card p-5">
      {grupos.map((g) => (
        <section key={g.dia} className="mb-6 last:mb-0">
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground first-letter:uppercase">
            {g.dia}
          </h4>
          <ol className="relative space-y-3 border-l-2 border-ink/15 pl-5">
            {g.items.map((a) => (
              <li key={a.id} className="relative">
                <span
                  className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-ink ${COLOR_ACCION[a.accion] ?? "bg-muted"}`}
                />
                <div className="flex items-start gap-2.5">
                  <Avatar id={a.user_id} nombre={a.user_id ? perfiles[a.user_id]?.nombre : "Sistema"} size="sm" />
                  <p className="min-w-0 flex-1 text-sm leading-snug">
                    <span className="font-semibold">{a.user_id ? (perfiles[a.user_id]?.nombre ?? "Alguien") : "Sistema"}</span>{" "}
                    <span className="text-muted-foreground">{ACCION_TEXTO[a.accion] ?? a.accion}</span>{" "}
                    {a.detalle && <span className="font-medium">{a.detalle}</span>}
                    {nombresGrupo?.[a.grupo_id] && (
                      <span className="ml-1.5 rounded-md border border-ink/30 px-1.5 py-0.5 text-[11px] font-semibold">
                        {nombresGrupo[a.grupo_id]}
                      </span>
                    )}
                  </p>
                  <time className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {format(new Date(a.created_at), "HH:mm")}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
