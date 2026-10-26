import { useMemo } from "react";
import { AlertTriangle, BarChart3, Info } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  calcularParticipacion,
  formulaVigente,
  type ActividadMinima,
  type CardMetrica,
  type ParesResumen,
} from "@/lib/participacion";
import type { Perfil } from "@/lib/gruplab";
import { Avatar } from "./Avatar";
import { EstadoVacio } from "./EstadoVacio";

const BARRAS = ["bg-primary", "bg-secondary", "bg-sun", "bg-mint", "bg-ink"];

function pct(n: number | null) {
  if (n == null) return "—";
  return `${(Math.round(n * 10) / 10).toLocaleString("es-AR")}%`;
}

export function ParticipacionPanel({
  actividad,
  integrantes,
  perfiles,
  cards,
  pares,
  compacto = false,
}: {
  actividad: (ActividadMinima & { created_at: string })[];
  integrantes: string[];
  perfiles: Record<string, Perfil | undefined>;
  cards: CardMetrica[];
  pares: ParesResumen[];
  compacto?: boolean;
}) {
  const filas = useMemo(
    () => calcularParticipacion(integrantes, cards, actividad, pares),
    [integrantes, cards, actividad, pares],
  );
  const formula = useMemo(() => formulaVigente(filas), [filas]);
  const hayDatos = filas.some((f) => f.participacion != null);

  const porDia = useMemo(() => {
    const dias: { dia: string; acciones: number }[] = [];
    const hoy = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(hoy);
      d.setDate(hoy.getDate() - i);
      dias.push({ dia: d.toISOString().slice(0, 10), acciones: 0 });
    }
    for (const a of actividad) {
      const k = a.created_at.slice(0, 10);
      const d = dias.find((x) => x.dia === k);
      if (d && a.user_id && integrantes.includes(a.user_id)) d.acciones++;
    }
    return dias.map((d) => ({ ...d, label: d.dia.slice(8, 10) + "/" + d.dia.slice(5, 7) }));
  }, [actividad, integrantes]);

  if (integrantes.length === 0) {
    return <EstadoVacio icon={BarChart3} titulo="Sin integrantes todavía" texto="Cuando el grupo tenga integrantes vas a ver su aporte acá." />;
  }

  return (
    <div className={compacto ? "space-y-4" : "grid gap-6 lg:grid-cols-[1.4fr_1fr]"}>
      <div className="brut rounded-2xl bg-card p-5">
        <h3 className="text-lg font-bold">Participación del equipo</h3>
        {hayDatos && (
          <div className="mt-4 flex h-5 overflow-hidden rounded-full border-2 border-ink">
            {filas
              .filter((f) => (f.participacion ?? 0) > 0)
              .map((f, i) => (
                <span
                  key={f.userId}
                  className={BARRAS[i % BARRAS.length]}
                  style={{ width: `${f.participacion}%` }}
                  title={`${perfiles[f.userId]?.nombre}: ${pct(f.participacion)}`}
                />
              ))}
          </div>
        )}
        <ul className="mt-5 space-y-4">
          {filas.map((f, i) => (
            <li key={f.userId}>
              <div className="flex items-center gap-3">
                <Avatar id={f.userId} nombre={perfiles[f.userId]?.nombre} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5 truncate font-semibold">
                      {perfiles[f.userId]?.nombre ?? "Integrante"}
                      {f.baja && (
                        <span title="Participación baja" className="text-destructive">
                          <AlertTriangle className="h-4 w-4" />
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-base font-bold">{pct(f.participacion)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full ${BARRAS[i % BARRAS.length]}`} style={{ width: `${f.participacion ?? 0}%` }} />
                  </div>
                </div>
              </div>
              {hayDatos && (
                <div className="mt-2 flex flex-wrap gap-1.5 pl-11">
                  <Chip label="Esfuerzo" valor={pct(f.esfuerzo)} />
                  <Chip label="Puntualidad" valor={pct(f.puntualidad)} />
                  <Chip label="Calidad" valor={pct(f.calidad)} />
                  <Chip label="Colaboración" valor={pct(f.colaboracion)} />
                  <Chip
                    label="Pares"
                    valor={f.pares != null ? pct(f.pares) : f.evaluacionesRecibidas ? `${f.evaluacionesRecibidas} eval.` : "—"}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
        {!hayDatos && (
          <p className="mt-4 text-sm text-muted-foreground">
            Todavía no hay tareas terminadas con personas asignadas. El porcentaje aparece cuando el grupo complete la
            primera.
          </p>
        )}
        <div className="mt-5 rounded-xl border-2 border-ink/15 bg-muted/60 p-3 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5 font-semibold text-foreground">
            <Info className="h-3.5 w-3.5" /> Cómo se calcula
          </p>
          <p className="mt-1">
            Esfuerzo de las tareas terminadas (50%), puntualidad respecto de la fecha límite (20%), calidad sin
            retrabajo y revisiones a compañeros (15%) y evaluación entre pares (15%). Si un factor todavía no tiene
            datos, su peso se reparte entre los demás.
          </p>
          {formula && (
            <p className="mt-1.5 font-mono text-[11px] text-foreground">
              Ahora: esfuerzo {pct(formula.esfuerzo)} · puntualidad {pct(formula.puntualidad)} · calidad/colab.{" "}
              {pct(formula.calidadColaboracion)} · pares {pct(formula.pares)}
            </p>
          )}
          <p className="mt-1.5">
            <AlertTriangle className="inline h-3 w-3 text-destructive" /> marca a quien aporta menos de la mitad de una
            parte equitativa.
          </p>
        </div>
      </div>
      {!compacto && (
        <div className="brut h-fit rounded-2xl bg-card p-5">
          <h3 className="text-lg font-bold">Actividad de los últimos 14 días</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porDia}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={1} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{ border: "2px solid var(--ink)", borderRadius: 10, fontSize: 12 }}
                  formatter={(v: number) => [v, "acciones"]}
                />
                <Bar dataKey="acciones" fill="var(--secondary)" stroke="var(--ink)" strokeWidth={2} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ label, valor }: { label: string; valor: string }) {
  return (
    <span className="rounded-md border border-ink/25 bg-paper px-1.5 py-0.5 text-[11px]">
      <span className="text-muted-foreground">{label}</span> <span className="font-mono font-bold">{valor}</span>
    </span>
  );
}
