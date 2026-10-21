import { useMemo } from "react";
import { AlertTriangle, BarChart3 } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { calcularParticipacion } from "@/lib/participacion";
import type { Actividad, Perfil } from "@/lib/gruplab";
import { Avatar } from "./Avatar";
import { EstadoVacio } from "./EstadoVacio";

const BARRAS = ["bg-primary", "bg-secondary", "bg-sun", "bg-mint", "bg-ink"];

export function ParticipacionPanel({
  actividad,
  integrantes,
  perfiles,
  compacto = false,
}: {
  actividad: Pick<Actividad, "user_id" | "accion" | "created_at">[];
  integrantes: string[];
  perfiles: Record<string, Perfil | undefined>;
  compacto?: boolean;
}) {
  const filas = useMemo(() => calcularParticipacion(actividad, integrantes), [actividad, integrantes]);
  const total = filas.reduce((s, f) => s + f.acciones, 0);

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
    <div className={compacto ? "space-y-4" : "grid gap-6 lg:grid-cols-[1.3fr_1fr]"}>
      <div className="brut rounded-2xl bg-card p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-bold">Aporte por integrante</h3>
          <span className="text-sm text-muted-foreground">{total} acciones</span>
        </div>
        {total > 0 && (
          <div className="mt-4 flex h-5 overflow-hidden rounded-full border-2 border-ink">
            {filas
              .filter((f) => f.porcentaje > 0)
              .map((f, i) => (
                <span
                  key={f.userId}
                  className={BARRAS[i % BARRAS.length]}
                  style={{ width: `${f.porcentaje}%` }}
                  title={`${perfiles[f.userId]?.nombre}: ${f.porcentaje}%`}
                />
              ))}
          </div>
        )}
        <ul className="mt-5 space-y-3">
          {filas.map((f, i) => (
            <li key={f.userId} className="flex items-center gap-3">
              <Avatar id={f.userId} nombre={perfiles[f.userId]?.nombre} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-semibold">{perfiles[f.userId]?.nombre ?? "Integrante"}</span>
                  <span className="font-mono font-bold">{f.porcentaje}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full ${BARRAS[i % BARRAS.length]}`} style={{ width: `${f.porcentaje}%` }} />
                </div>
              </div>
              <span className="w-16 text-right text-xs text-muted-foreground">{f.acciones} acc.</span>
              {f.baja && (
                <span title="Participación baja" className="text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                </span>
              )}
            </li>
          ))}
        </ul>
        {total === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">Todavía no hay acciones registradas.</p>
        )}
        <p className="mt-5 text-xs text-muted-foreground">
          Se cuentan tareas creadas, movidas, editadas, eliminadas y archivos adjuntados. El ícono{" "}
          <AlertTriangle className="inline h-3 w-3 text-destructive" /> marca a quien aporta menos de la mitad de
          una parte equitativa.
        </p>
      </div>
      {!compacto && (
        <div className="brut rounded-2xl bg-card p-5">
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
