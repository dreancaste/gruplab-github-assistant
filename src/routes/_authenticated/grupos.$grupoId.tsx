import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronLeft, Crown, Inbox, LogOut, Pencil, Star, Trash2, UserMinus, UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  actividadQuery,
  cardsQuery,
  grupoQuery,
  mensajeError,
  misEvaluacionesQuery,
  paresQuery,
  solicitudesGrupoQuery,
  type Card,
} from "@/lib/gruplab";
import { estadoVencimiento } from "@/lib/vencimiento";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KanbanBoard } from "@/components/gruplab/KanbanBoard";
import { CardDialog } from "@/components/gruplab/CardDialog";
import { ParticipacionPanel } from "@/components/gruplab/ParticipacionPanel";
import { ActividadFeed } from "@/components/gruplab/ActividadFeed";
import { Avatar, AvatarStack } from "@/components/gruplab/Avatar";
import { Codigo } from "@/components/gruplab/Codigo";

export const Route = createFileRoute("/_authenticated/grupos/$grupoId")({
  head: () => ({
    meta: [
      { title: "Tablero del grupo — GrupLab" },
      { name: "description", content: "Tablero Kanban, participación y actividad del grupo." },
      { property: "og:title", content: "Tablero del grupo — GrupLab" },
      { property: "og:description", content: "Tablero Kanban, participación y actividad del grupo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(grupoQuery(params.grupoId)),
      context.queryClient.ensureQueryData(cardsQuery(params.grupoId)),
      context.queryClient.ensureQueryData(actividadQuery(params.grupoId)),
      context.queryClient.ensureQueryData(paresQuery([params.grupoId])),
      context.queryClient.ensureQueryData(misEvaluacionesQuery(params.grupoId)),
    ]),
  component: GrupoPage,
});

function GrupoPage() {
  const { grupoId } = Route.useParams();
  const qc = useQueryClient();
  const { data: g } = useSuspenseQuery(grupoQuery(grupoId));
  const { data: cards } = useSuspenseQuery(cardsQuery(grupoId));
  const { data: actividad } = useSuspenseQuery(actividadQuery(grupoId));
  const { data: pares } = useSuspenseQuery(paresQuery([grupoId]));
  const { data: misEvaluaciones } = useSuspenseQuery(misEvaluacionesQuery(grupoId));
  const [abiertaId, setAbiertaId] = useState<string | null>(null);
  const abierta = cards.find((c) => c.id === abiertaId) ?? null;

  useEffect(() => {
    const ch = supabase
      .channel(`grupo-${grupoId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cards", filter: `grupo_id=eq.${grupoId}` }, () =>
        qc.invalidateQueries({ queryKey: ["cards", grupoId] }),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "actividad", filter: `grupo_id=eq.${grupoId}` }, () => {
        qc.invalidateQueries({ queryKey: ["actividad", grupoId] });
        qc.invalidateQueries({ queryKey: ["pares", [grupoId]] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [grupoId, qc]);

  const hechas = cards.filter((c) => c.estado === "hecho").length;
  const puntuadas = cards.filter((c) => c.puntuacion != null);
  const promedio = puntuadas.length ? puntuadas.reduce((s, c) => s + (c.puntuacion ?? 0), 0) / puntuadas.length : null;
  const puedeEditar = g.esMiembro || g.esStaff;
  const vencidas = cards.filter((c) => estadoVencimiento(c.fecha_limite, c.estado) === "vencida").length;
  const pendientesEval = useMemo(() => {
    if (!g.esMiembro) return new Set<string>();
    const otros = g.integrantes.filter((id) => id !== g.uid);
    return new Set(
      cards
        .filter((c) => c.estado === "hecho")
        .filter((c) => otros.some((id) => !misEvaluaciones.some((e) => e.card_id === c.id && e.evaluado_id === id)))
        .map((c) => c.id),
    );
  }, [cards, misEvaluaciones, g.esMiembro, g.integrantes, g.uid]);

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      {g.aula && (
        <Link
          to="/aulas/$aulaId"
          params={{ aulaId: g.aula.id }}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> {g.aula.nombre}
        </Link>
      )}
      <div className="mt-2 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-4xl font-extrabold sm:text-5xl">{g.grupo.nombre}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <AvatarStack ids={g.integrantes} perfiles={g.perfiles} max={6} />
            <span className="text-sm text-muted-foreground">
              {g.integrantes.length} integrante{g.integrantes.length === 1 ? "" : "s"}
            </span>
            {g.grupo.es_independiente && g.grupo.codigo && <Codigo codigo={g.grupo.codigo} />}
            {g.esStaff && (
              <span className="rounded-full border-2 border-ink bg-secondary px-2.5 py-0.5 text-xs font-bold text-secondary-foreground">
                Vista docente
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Tareas" valor={String(cards.length)} />
          <Stat label="Hechas" valor={cards.length ? `${Math.round((hechas / cards.length) * 100)}%` : "—"} />
          <Stat label="Vencidas" valor={String(vencidas)} alerta={vencidas > 0} />
          <Stat label="Promedio" valor={promedio != null ? promedio.toFixed(1) : "—"} icono />
        </div>
      </div>

      <Tabs defaultValue="tablero" className="mt-8">
        <TabsList className="flex-wrap">
          <TabsTrigger value="tablero">Tablero</TabsTrigger>
          <TabsTrigger value="participacion">Participación</TabsTrigger>
          <TabsTrigger value="actividad">Actividad</TabsTrigger>
          <TabsTrigger value="integrantes">Integrantes</TabsTrigger>
        </TabsList>
        <TabsContent value="tablero" className="mt-6">
          {!puedeEditar && <p className="mb-3 text-sm text-muted-foreground">Solo lectura.</p>}
          <KanbanBoard
            grupoId={grupoId}
            cards={cards}
            perfiles={g.perfiles}
            puedeEditar={puedeEditar}
            onAbrir={(c: Card) => setAbiertaId(c.id)}
            pendientesEval={pendientesEval}
            contexto={{ esIndependiente: g.grupo.es_independiente, integrantes: g.integrantes, uid: g.uid, esStaff: g.esStaff }}
          />
        </TabsContent>
        <TabsContent value="participacion" className="mt-6">
          <ParticipacionPanel
            actividad={actividad}
            integrantes={g.integrantes}
            perfiles={g.perfiles}
            cards={cards}
            pares={pares}
          />
        </TabsContent>
        <TabsContent value="actividad" className="mt-6">
          <ActividadFeed actividad={actividad} perfiles={g.perfiles} />
        </TabsContent>
        <TabsContent value="integrantes" className="mt-6">
          <Integrantes />
        </TabsContent>
      </Tabs>

      <CardDialog
        card={abierta}
        onClose={() => setAbiertaId(null)}
        grupoId={grupoId}
        uid={g.uid}
        esStaff={g.esStaff}
        puedeEditar={puedeEditar}
        puedeGestionar={g.puedeGestionar}
        perfiles={g.perfiles}
        integrantes={g.integrantes}
        esMiembro={g.esMiembro}
        esIndependiente={g.grupo.es_independiente}
        misEvaluaciones={misEvaluaciones}
      />
    </main>
  );
}

function Stat({ label, valor, icono, alerta }: { label: string; valor: string; icono?: boolean; alerta?: boolean }) {
  return (
    <div className={`brut-sm min-w-24 rounded-xl px-4 py-2 ${alerta ? "bg-destructive text-destructive-foreground" : "bg-card"}`}>
      <p className={`text-[11px] font-bold uppercase tracking-wider ${alerta ? "" : "text-muted-foreground"}`}>{label}</p>
      <p className="flex items-center gap-1 font-display text-2xl font-extrabold">
        {icono && <Star className="h-4 w-4" />} {valor}
      </p>
    </div>
  );
}

function Integrantes() {
  const { grupoId } = Route.useParams();
  const { data: g } = useSuspenseQuery(grupoQuery(grupoId));
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [agregar, setAgregar] = useState<string>("");
  const [renombrar, setRenombrar] = useState(false);
  const [nombre, setNombre] = useState(g.grupo.nombre);

  async function refrescar() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["grupo", grupoId] }),
      qc.invalidateQueries({ queryKey: ["actividad", grupoId] }),
      qc.invalidateQueries({ queryKey: ["espacios"] }),
      g.grupo.aula_id ? qc.invalidateQueries({ queryKey: ["aula", g.grupo.aula_id] }) : Promise.resolve(),
    ]);
  }

  async function rpc(fn: () => PromiseLike<{ error: { message: string } | null }>, ok?: string) {
    const { error } = await fn();
    if (error) {
      toast.error(mensajeError(error));
      return false;
    }
    if (ok) toast.success(ok);
    await refrescar();
    return true;
  }

  async function salir() {
    if (!confirm("¿Seguro que querés salir del grupo?")) return;
    const { data, error } = await supabase.rpc("quitar_integrante", { _grupo_id: grupoId, _user_id: g.uid });
    if (error) { toast.error(mensajeError(error)); return; }
    toast.success(data ? "Saliste y el tablero se eliminó" : "Saliste del grupo");
    await qc.invalidateQueries({ queryKey: ["espacios"] });
    if (g.grupo.aula_id && !g.esStaff) {
      await qc.invalidateQueries({ queryKey: ["aula", g.grupo.aula_id] });
      navigate({ to: "/aulas/$aulaId", params: { aulaId: g.grupo.aula_id } });
    } else if (!g.esStaff) navigate({ to: "/espacios" });
    else refrescar();
  }

  async function eliminarGrupo() {
    if (!confirm("¿Eliminar el grupo con todas sus tareas y archivos? No se puede deshacer.")) return;
    const { error } = await supabase.from("grupos").delete().eq("id", grupoId);
    if (error) { toast.error(mensajeError(error)); return; }
    toast.success("Grupo eliminado");
    await qc.invalidateQueries({ queryKey: ["espacios"] });
    if (g.grupo.aula_id) {
      await qc.invalidateQueries({ queryKey: ["aula", g.grupo.aula_id] });
      navigate({ to: "/aulas/$aulaId", params: { aulaId: g.grupo.aula_id } });
    } else navigate({ to: "/espacios" });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="brut rounded-2xl bg-card p-5">
        <h3 className="text-lg font-bold">Integrantes</h3>
        <ul className="mt-4 divide-y-2 divide-ink/10">
          {g.integrantes.map((id) => {
            const p = g.perfiles[id];
            const esAdmin = g.grupo.admin_id === id;
            return (
              <li key={id} className="flex items-center gap-3 py-3">
                <Avatar id={id} nombre={p?.nombre} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    {p?.nombre ?? "Integrante"}
                    {id === g.uid && <span className="text-xs text-muted-foreground">(vos)</span>}
                    {esAdmin && (
                      <span className="flex items-center gap-1 rounded-full border-2 border-ink bg-sun px-2 text-[11px] font-bold">
                        <Crown className="h-3 w-3" /> Admin
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{p?.email}</p>
                </div>
                {g.puedeGestionar && id !== g.uid && (
                  <div className="flex gap-1">
                    {!esAdmin && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Hacer admin del grupo"
                        onClick={() =>
                          rpc(() => supabase.rpc("transferir_admin", { _grupo_id: grupoId, _user_id: id }), "Admin actualizado")
                        }
                      >
                        <Crown />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Quitar del grupo"
                      onClick={() =>
                        confirm(`¿Quitar a ${p?.nombre ?? "este integrante"}?`) &&
                        rpc(() => supabase.rpc("quitar_integrante", { _grupo_id: grupoId, _user_id: id }), "Integrante quitado")
                      }
                    >
                      <UserMinus />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
          {g.integrantes.length === 0 && (
            <li className="py-3 text-sm text-muted-foreground">Este grupo todavía no tiene integrantes.</li>
          )}
        </ul>

        {g.puedeGestionar && g.grupo.aula_id && (
          <div className="mt-4 flex flex-wrap gap-2 border-t-2 border-ink/10 pt-4">
            <Select value={agregar} onValueChange={setAgregar}>
              <SelectTrigger className="h-10 min-w-56 flex-1 border-2 border-ink">
                <SelectValue placeholder={g.alumnosLibres.length ? "Elegí un alumno sin grupo" : "No hay alumnos sin grupo"} />
              </SelectTrigger>
              <SelectContent>
                {g.alumnosLibres.map((id) => (
                  <SelectItem key={id} value={id}>
                    {g.perfiles[id]?.nombre ?? id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={!agregar}
              onClick={async () => {
                const ok = await rpc(
                  () => supabase.rpc("agregar_integrante", { _grupo_id: grupoId, _user_id: agregar }),
                  "Integrante sumado",
                );
                if (ok) setAgregar("");
              }}
            >
              <UserPlus /> Sumar
            </Button>
          </div>
        )}
        {g.grupo.es_independiente && (
          <p className="mt-4 border-t-2 border-ink/10 pt-4 text-sm text-muted-foreground">
            Para sumar gente, compartí el código del tablero.
          </p>
        )}
      </div>

      <div className="space-y-4">
        {g.puedeGestionar && g.grupo.aula_id && <Solicitudes refrescar={refrescar} />}
        {g.puedeGestionar && (
          <div className="brut rounded-2xl bg-card p-5">
            <h3 className="text-lg font-bold">Configuración</h3>
            <div className="mt-4 grid gap-2">
              <Button variant="outline" onClick={() => setRenombrar(true)}>
                <Pencil /> Cambiar nombre
              </Button>
              <Button variant="destructive" onClick={eliminarGrupo}>
                <Trash2 /> Eliminar grupo
              </Button>
            </div>
          </div>
        )}
        {g.esMiembro && (
          <div className="brut rounded-2xl bg-card p-5">
            <h3 className="text-lg font-bold">Salir</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Si sos admin, el rol pasa al siguiente integrante.
              {g.grupo.es_independiente && " Si sos el único, el tablero se elimina."}
            </p>
            <Button variant="outline" className="mt-3" onClick={salir}>
              <LogOut /> Salir del grupo
            </Button>
          </div>
        )}
      </div>

      <Dialog open={renombrar} onOpenChange={setRenombrar}>
        <DialogContent>
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await rpc(
                () => supabase.from("grupos").update({ nombre: nombre.trim() }).eq("id", grupoId),
                "Nombre actualizado",
              );
              if (ok) setRenombrar(false);
            }}
          >
            <DialogHeader>
              <DialogTitle>Cambiar nombre</DialogTitle>
            </DialogHeader>
            <Input required value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setRenombrar(false)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Solicitudes({ refrescar }: { refrescar: () => Promise<void> }) {
  const { grupoId } = Route.useParams();
  const qc = useQueryClient();
  const { data } = useQuery(solicitudesGrupoQuery(grupoId));
  const [ocupado, setOcupado] = useState<string | null>(null);
  const lista = data?.solicitudes ?? [];

  async function resolver(id: string, aceptar: boolean) {
    setOcupado(id);
    const { error } = await supabase.rpc("resolver_solicitud", { _solicitud_id: id, _aceptar: aceptar });
    setOcupado(null);
    if (error) { toast.error(mensajeError(error)); return; }
    toast.success(aceptar ? "Solicitud aceptada" : "Solicitud rechazada");
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["solicitudes-grupo", grupoId] }),
      qc.invalidateQueries({ queryKey: ["solicitudes-aula"] }),
      refrescar(),
    ]);
  }

  return (
    <div className="brut rounded-2xl bg-card p-5">
      <h3 className="flex items-center gap-2 text-lg font-bold">
        <Inbox className="h-5 w-5" /> Solicitudes de ingreso
        {lista.length > 0 && (
          <span className="rounded-full border-2 border-ink bg-primary px-2 text-xs font-bold text-primary-foreground">
            {lista.length}
          </span>
        )}
      </h3>
      {lista.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No hay pedidos pendientes.</p>
      ) : (
        <ul className="mt-3 divide-y-2 divide-ink/10">
          {lista.map((s) => {
            const p = data?.perfiles[s.user_id];
            return (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <Avatar id={s.user_id} nombre={p?.nombre} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p?.nombre ?? "Alumno"}</p>
                  <p className="truncate text-xs text-muted-foreground">{p?.email}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Rechazar"
                  disabled={ocupado === s.id}
                  onClick={() => resolver(s.id, false)}
                >
                  <X />
                </Button>
                <Button size="sm" disabled={ocupado === s.id} onClick={() => resolver(s.id, true)}>
                  <Check /> Aceptar
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
