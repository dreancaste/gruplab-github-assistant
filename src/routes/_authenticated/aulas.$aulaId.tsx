import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlarmClock,
  ArrowUpRight,
  CheckCircle2,
  Inbox,
  LayoutGrid,
  Lock,
  LogOut,
  Plus,
  Send,
  Star,
  Trash2,
  UserMinus,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  aulaActividadQuery,
  aulaQuery,
  mensajeError,
  paresQuery,
  ROL_LABEL,
  solicitudesAulaQuery,
  type Rol,
} from "@/lib/gruplab";
import { estadoVencimiento } from "@/lib/vencimiento";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarStack } from "@/components/gruplab/Avatar";
import { Codigo } from "@/components/gruplab/Codigo";
import { EstadoVacio } from "@/components/gruplab/EstadoVacio";
import { ParticipacionPanel } from "@/components/gruplab/ParticipacionPanel";
import { ActividadFeed } from "@/components/gruplab/ActividadFeed";

export const Route = createFileRoute("/_authenticated/aulas/$aulaId")({
  head: () => ({
    meta: [
      { title: "Aula — GrupLab" },
      { name: "description", content: "Grupos, participación y actividad del aula." },
      { property: "og:title", content: "Aula — GrupLab" },
      { property: "og:description", content: "Grupos, participación y actividad del aula." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(aulaQuery(params.aulaId)),
  component: AulaPage,
});

function AulaPage() {
  const { aulaId } = Route.useParams();
  const { data } = useSuspenseQuery(aulaQuery(aulaId));
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [crearAbierto, setCrearAbierto] = useState(false);
  const alumnos = data.miembros.filter((m) => m.rol === "alumno");
  const { data: solicitudes = [] } = useQuery(solicitudesAulaQuery(aulaId));
  const [enviando, setEnviando] = useState<string | null>(null);

  async function pedirIngreso(grupoId: string) {
    setEnviando(grupoId);
    const { error } = await supabase.rpc("solicitar_ingreso", { _grupo_id: grupoId });
    setEnviando(null);
    if (error) { toast.error(mensajeError(error)); return; }
    toast.success("Solicitud enviada. Te avisamos cuando la acepten.");
    qc.invalidateQueries({ queryKey: ["solicitudes-aula", aulaId] });
  }

  async function cancelarPedido(id: string) {
    const { error } = await supabase.from("solicitudes_grupo").delete().eq("id", id);
    if (error) { toast.error(mensajeError(error)); return; }
    toast.success("Solicitud cancelada");
    qc.invalidateQueries({ queryKey: ["solicitudes-aula", aulaId] });
  }

  async function eliminarAula() {
    if (!confirm(`¿Eliminar "${data.aula.nombre}" con todos sus grupos, tareas y archivos? No se puede deshacer.`)) return;
    const { error } = await supabase.from("aulas").delete().eq("id", aulaId);
    if (error) { toast.error(mensajeError(error)); return; }
    await qc.invalidateQueries({ queryKey: ["espacios"] });
    toast.success("Aula eliminada");
    navigate({ to: "/espacios" });
  }

  async function salirAula() {
    if (!confirm("¿Salir de esta materia? También vas a salir de tu grupo.")) return;
    const { error } = await supabase.rpc("salir_de_aula", { _aula_id: aulaId });
    if (error) { toast.error(mensajeError(error)); return; }
    await qc.invalidateQueries({ queryKey: ["espacios"] });
    navigate({ to: "/espacios" });
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <div className="brut overflow-hidden rounded-3xl bg-card">
        <div className="h-4 border-b-2 border-ink bg-primary" />
        <div className="flex flex-wrap items-end justify-between gap-5 p-6 sm:p-8">
          <div className="max-w-2xl">
            <span className="rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-bold">
              {data.rol ? ROL_LABEL[data.rol] : ""}
            </span>
            <h1 className="mt-3 text-4xl font-extrabold sm:text-5xl">{data.aula.nombre}</h1>
            {data.aula.descripcion && <p className="mt-2 text-muted-foreground">{data.aula.descripcion}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" /> {alumnos.length} alumnos
              </span>
              <span>{data.grupos.length} grupos</span>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            {data.esStaff && <Codigo codigo={data.aula.codigo} label="Invitación" />}
            {data.rol === "admin" ? (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={eliminarAula}>
                <Trash2 /> Eliminar aula
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={salirAula}>
                <LogOut /> Salir del aula
              </Button>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue={data.esStaff ? "resumen" : "grupos"} className="mt-8">
        <TabsList className="flex-wrap">
          {data.esStaff && <TabsTrigger value="resumen">Resumen</TabsTrigger>}
          <TabsTrigger value="grupos">Grupos</TabsTrigger>
          {data.esStaff && <TabsTrigger value="participacion">Participación</TabsTrigger>}
          {data.esStaff && <TabsTrigger value="actividad">Actividad</TabsTrigger>}
          <TabsTrigger value="integrantes">Integrantes</TabsTrigger>
        </TabsList>

        <TabsContent value="grupos" className="mt-6">
          {data.rol === "alumno" && !data.miGrupoId && (
            <div className="brut mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-sun p-5">
              <div>
                <h3 className="text-lg font-bold">Todavía no estás en un grupo</h3>
                <p className="text-sm">Creá uno y quedás como admin, o pedí unirte a uno de los grupos de abajo.</p>
              </div>
              <Button variant="ink" onClick={() => setCrearAbierto(true)}>
                <Plus /> Crear mi grupo
              </Button>
            </div>
          )}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Grupos</h2>
            {data.esStaff && (
              <Button onClick={() => setCrearAbierto(true)}>
                <Plus /> Nuevo grupo
              </Button>
            )}
          </div>
          {data.grupos.length === 0 ? (
            <EstadoVacio icon={Users} titulo="No hay grupos todavía" texto="Los grupos los pueden crear los alumnos o el docente." />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.grupos.map((g) => {
                const accesible = data.esStaff || data.miGrupoId === g.id;
                const pendientesGrupo = solicitudes.filter((s) => s.grupo_id === g.id);
                const miPedido = pendientesGrupo.find((s) => s.user_id === data.uid);
                const puedePedir = data.rol === "alumno" && !data.miGrupoId;
                const pct = g.totalCards ? Math.round((g.hechas / g.totalCards) * 100) : 0;
                const contenido = (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-xl font-bold leading-tight">{g.nombre}</h3>
                      {accesible ? (
                        <ArrowUpRight className="h-5 w-5 opacity-40 transition group-hover:opacity-100" />
                      ) : (
                        <Lock className="h-4 w-4 opacity-40" />
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {data.miGrupoId === g.id && (
                        <span className="w-fit rounded-full border-2 border-ink bg-mint px-2 text-[11px] font-bold">Tu grupo</span>
                      )}
                      {(data.esStaff || g.admin_id === data.uid) && pendientesGrupo.length > 0 && (
                        <span className="flex w-fit items-center gap-1 rounded-full border-2 border-ink bg-primary px-2 text-[11px] font-bold text-primary-foreground">
                          <Inbox className="h-3 w-3" /> {pendientesGrupo.length} solicitud{pendientesGrupo.length === 1 ? "" : "es"}
                        </span>
                      )}
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                        <span>
                          {g.hechas}/{g.totalCards} tareas hechas
                        </span>
                        <span>{pct}%</span>
                      </div>
                      <div className="mt-1.5 h-3 overflow-hidden rounded-full border-2 border-ink bg-muted">
                        <div className="h-full bg-mint" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-5">
                      {g.integrantes.length ? (
                        <AvatarStack ids={g.integrantes} perfiles={data.perfiles} />
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin integrantes</span>
                      )}
                      {g.promedio != null && (
                        <span className="flex items-center gap-1 rounded-lg border-2 border-ink bg-sun px-2 py-0.5 text-sm font-bold">
                          <Star className="h-3.5 w-3.5" /> {g.promedio.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </>
                );
                return accesible ? (
                  <Link
                    key={g.id}
                    to="/grupos/$grupoId"
                    params={{ grupoId: g.id }}
                    className="brut brut-lift group flex flex-col rounded-2xl bg-card p-5"
                  >
                    {contenido}
                  </Link>
                ) : (
                  <div key={g.id} className="flex flex-col rounded-2xl border-2 border-ink bg-card/70 p-5">
                    {contenido}
                    {puedePedir && (
                      <div className="mt-4 border-t-2 border-ink/10 pt-4">
                        {miPedido ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-sm font-semibold">
                              <CheckCircle2 className="h-4 w-4 text-mint" /> Solicitud enviada
                            </span>
                            <Button size="sm" variant="ghost" onClick={() => cancelarPedido(miPedido.id)}>
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            disabled={enviando === g.id}
                            onClick={() => pedirIngreso(g.id)}
                          >
                            <Send /> Pedir unirme
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {data.esStaff && (
          <TabsContent value="resumen" className="mt-6">
            <ResumenAula />
          </TabsContent>
        )}
        {data.esStaff && (
          <TabsContent value="participacion" className="mt-6">
            <ParticipacionAula />
          </TabsContent>
        )}
        {data.esStaff && (
          <TabsContent value="actividad" className="mt-6">
            <ActividadAula />
          </TabsContent>
        )}
        <TabsContent value="integrantes" className="mt-6">
          <IntegrantesAula />
        </TabsContent>
      </Tabs>

      <CrearGrupoDialog open={crearAbierto} onClose={() => setCrearAbierto(false)} aulaId={aulaId} esStaff={data.esStaff} />
    </main>
  );
}

function ParticipacionAula() {
  const { aulaId } = Route.useParams();
  const { data } = useSuspenseQuery(aulaQuery(aulaId));
  const ids = data.grupos.map((g) => g.id);
  const { data: actividad = [], isLoading } = useQuery(aulaActividadQuery(aulaId, ids));
  const { data: pares = [] } = useQuery(paresQuery(ids));
  const enGrupo = new Set(data.grupos.flatMap((g) => g.integrantes));
  const sinGrupo = data.miembros.filter((m) => m.rol === "alumno" && !enGrupo.has(m.user_id));

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <div className="space-y-6">
      {sinGrupo.length > 0 && (
        <div className="brut rounded-2xl bg-sun/40 p-5">
          <h3 className="font-bold">Alumnos sin grupo ({sinGrupo.length})</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {sinGrupo.map((m) => (
              <span key={m.user_id} className="flex items-center gap-2 rounded-full border-2 border-ink bg-card py-0.5 pl-0.5 pr-3 text-sm font-semibold">
                <Avatar id={m.user_id} nombre={data.perfiles[m.user_id]?.nombre} size="sm" />
                {data.perfiles[m.user_id]?.nombre}
              </span>
            ))}
          </div>
        </div>
      )}
      {data.grupos.length === 0 ? (
        <EstadoVacio icon={Users} titulo="Sin grupos todavía" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {data.grupos.map((g) => (
            <div key={g.id}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-lg font-bold">{g.nombre}</h3>
                <Link to="/grupos/$grupoId" params={{ grupoId: g.id }} className="text-sm font-semibold text-secondary hover:underline">
                  Ver tablero →
                </Link>
              </div>
              <ParticipacionPanel
                compacto
                actividad={actividad.filter((a) => a.grupo_id === g.id)}
                integrantes={g.integrantes}
                perfiles={data.perfiles}
                cards={data.cards.filter((c) => c.grupo_id === g.id)}
                pares={pares.filter((p) => p.grupo_id === g.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResumenAula() {
  const { aulaId } = Route.useParams();
  const { data } = useSuspenseQuery(aulaQuery(aulaId));
  const alumnos = data.miembros.filter((m) => m.rol === "alumno").length;
  const total = data.cards.length;
  const hechas = data.cards.filter((c) => c.estado === "hecho").length;
  const avance = total ? Math.round((hechas / total) * 100) : 0;
  const puntuadas = data.cards.filter((c) => c.puntuacion != null);
  const promedio = puntuadas.length
    ? puntuadas.reduce((s, c) => s + (c.puntuacion ?? 0), 0) / puntuadas.length
    : null;
  const esVencida = (c: (typeof data.cards)[number]) => estadoVencimiento(c.fecha_limite, c.estado) === "vencida";
  const vencidas = data.cards.filter(esVencida).length;

  const filas = data.grupos
    .map((g) => {
      const cs = data.cards.filter((c) => c.grupo_id === g.id);
      return {
        ...g,
        avance: g.totalCards ? Math.round((g.hechas / g.totalCards) * 100) : 0,
        vencidas: cs.filter(esVencida).length,
        porEstado: {
          backlog: cs.filter((c) => c.estado === "backlog").length,
          progreso: cs.filter((c) => c.estado === "progreso").length,
          revision: cs.filter((c) => c.estado === "revision").length,
          hecho: cs.filter((c) => c.estado === "hecho").length,
        },
      };
    })
    .sort((a, b) => b.avance - a.avance);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Grupos activos" valor={String(data.grupos.length)} icon={LayoutGrid} />
        <Kpi label="Alumnos inscriptos" valor={String(alumnos)} icon={Users} />
        <Kpi label="Avance global" valor={`${avance}%`} pie={`${hechas} de ${total} tareas hechas`} icon={CheckCircle2} />
        <Kpi label="Promedio de notas" valor={promedio != null ? `${promedio.toFixed(1)}/10` : "—"} icon={Star} />
        <Kpi label="Tareas vencidas" valor={String(vencidas)} icon={AlarmClock} alerta={vencidas > 0} />
      </div>

      <div className="brut rounded-2xl bg-card p-5">
        <h3 className="text-lg font-bold">Avance por grupo</h3>
        {filas.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Todavía no hay grupos en esta aula.</p>
        ) : (
          <ul className="mt-4 space-y-5">
            {filas.map((g) => (
              <li key={g.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to="/grupos/$grupoId" params={{ grupoId: g.id }} className="font-bold hover:underline">
                      {g.nombre}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {g.integrantes.length} integrante{g.integrantes.length === 1 ? "" : "s"}
                    </span>
                    {g.vencidas > 0 && (
                      <span className="flex items-center gap-1 rounded-md border-2 border-ink bg-destructive px-1.5 text-[11px] font-bold text-destructive-foreground">
                        <AlarmClock className="h-3 w-3" /> {g.vencidas} vencida{g.vencidas === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {g.promedio != null && (
                      <span className="flex items-center gap-1 rounded-lg border-2 border-ink bg-sun px-2 py-0.5 text-xs font-bold">
                        <Star className="h-3 w-3" /> {g.promedio.toFixed(1)}
                      </span>
                    )}
                    <span className="font-mono font-bold">{g.avance}%</span>
                  </div>
                </div>
                <div className="mt-2 flex h-4 overflow-hidden rounded-full border-2 border-ink bg-muted">
                  {g.totalCards > 0 && (
                    <>
                      <span className="bg-estado-hecho" style={{ width: `${(g.porEstado.hecho / g.totalCards) * 100}%` }} />
                      <span className="bg-estado-revision" style={{ width: `${(g.porEstado.revision / g.totalCards) * 100}%` }} />
                      <span className="bg-estado-progreso" style={{ width: `${(g.porEstado.progreso / g.totalCards) * 100}%` }} />
                    </>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {g.porEstado.backlog} en backlog · {g.porEstado.progreso} en progreso · {g.porEstado.revision} en revisión ·{" "}
                  {g.porEstado.hecho} hechas
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  valor,
  pie,
  icon: Icon,
  alerta,
}: {
  label: string;
  valor: string;
  pie?: string;
  icon: React.ComponentType<{ className?: string }>;
  alerta?: boolean;
}) {
  return (
    <div className={`brut rounded-2xl p-4 ${alerta ? "bg-destructive text-destructive-foreground" : "bg-card"}`}>
      <p className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${alerta ? "" : "text-muted-foreground"}`}>
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="mt-1 font-display text-3xl font-extrabold">{valor}</p>
      {pie && <p className={`text-xs ${alerta ? "" : "text-muted-foreground"}`}>{pie}</p>}
    </div>
  );
}

function ActividadAula() {
  const { aulaId } = Route.useParams();
  const { data } = useSuspenseQuery(aulaQuery(aulaId));
  const ids = data.grupos.map((g) => g.id);
  const { data: actividad = [], isLoading } = useQuery(aulaActividadQuery(aulaId, ids));
  const [filtro, setFiltro] = useState("todos");
  const nombres = Object.fromEntries(data.grupos.map((g) => [g.id, g.nombre]));
  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  const lista = filtro === "todos" ? actividad : actividad.filter((a) => a.grupo_id === filtro);
  return (
    <div className="space-y-4">
      <Select value={filtro} onValueChange={setFiltro}>
        <SelectTrigger className="h-10 w-64 border-2 border-ink bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los grupos</SelectItem>
          {data.grupos.map((g) => (
            <SelectItem key={g.id} value={g.id}>
              {g.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ActividadFeed actividad={lista.slice(0, 300)} perfiles={data.perfiles} nombresGrupo={filtro === "todos" ? nombres : undefined} />
    </div>
  );
}

function IntegrantesAula() {
  const { aulaId } = Route.useParams();
  const { data } = useSuspenseQuery(aulaQuery(aulaId));
  const qc = useQueryClient();
  const esAdmin = data.rol === "admin";
  const grupoDe = new Map<string, string>();
  for (const g of data.grupos) for (const u of g.integrantes) grupoDe.set(u, g.nombre);
  const orden: Record<Rol, number> = { admin: 0, profesor: 1, alumno: 2 };
  const miembros = [...data.miembros].sort(
    (a, b) => orden[a.rol] - orden[b.rol] || (data.perfiles[a.user_id]?.nombre ?? "").localeCompare(data.perfiles[b.user_id]?.nombre ?? ""),
  );

  async function cambiarRol(userId: string, rol: Rol) {
    const { error } = await supabase.rpc("cambiar_rol_aula", { _aula_id: aulaId, _user_id: userId, _rol: rol });
    if (error) { toast.error(mensajeError(error)); return; }
    toast.success("Rol actualizado");
    qc.invalidateQueries({ queryKey: ["aula", aulaId] });
  }

  async function quitar(userId: string) {
    if (!confirm(`¿Quitar a ${data.perfiles[userId]?.nombre ?? "esta persona"} del aula?`)) return;
    for (const g of data.grupos.filter((g) => g.integrantes.includes(userId))) {
      await supabase.rpc("quitar_integrante", { _grupo_id: g.id, _user_id: userId });
    }
    const { error } = await supabase.from("aula_miembros").delete().eq("aula_id", aulaId).eq("user_id", userId);
    if (error) { toast.error(mensajeError(error)); return; }
    qc.invalidateQueries({ queryKey: ["aula", aulaId] });
  }

  return (
    <div className="brut rounded-2xl bg-card p-5">
      <ul className="divide-y-2 divide-ink/10">
        {miembros.map((m) => {
          const p = data.perfiles[m.user_id];
          return (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar id={m.user_id} nombre={p?.nombre} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {p?.nombre ?? "Integrante"} {m.user_id === data.uid && <span className="text-xs text-muted-foreground">(vos)</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {p?.email}
                  {grupoDe.get(m.user_id) && ` · ${grupoDe.get(m.user_id)}`}
                </p>
              </div>
              {esAdmin && m.user_id !== data.uid ? (
                <div className="flex items-center gap-1">
                  <Select value={m.rol} onValueChange={(v) => cambiarRol(m.user_id, v as Rol)}>
                    <SelectTrigger className="h-9 w-32 border-2 border-ink">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alumno">Alumno</SelectItem>
                      <SelectItem value="profesor">Docente</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" title="Quitar del aula" onClick={() => quitar(m.user_id)}>
                    <UserMinus />
                  </Button>
                </div>
              ) : (
                <span className="rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-bold">{ROL_LABEL[m.rol]}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CrearGrupoDialog({
  open,
  onClose,
  aulaId,
  esStaff,
}: {
  open: boolean;
  onClose: () => void;
  aulaId: string;
  esStaff: boolean;
}) {
  const [nombre, setNombre] = useState("");
  const [cargando, setCargando] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    const { data, error } = await supabase.rpc("crear_grupo", { _aula_id: aulaId, _nombre: nombre });
    setCargando(false);
    if (error) { toast.error(mensajeError(error)); return; }
    await qc.invalidateQueries({ queryKey: ["aula", aulaId] });
    await qc.invalidateQueries({ queryKey: ["espacios"] });
    setNombre("");
    onClose();
    toast.success("Grupo creado");
    navigate({ to: "/grupos/$grupoId", params: { grupoId: data as string } });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={crear} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Nuevo grupo</DialogTitle>
            <DialogDescription>
              {esStaff
                ? "El primer alumno que sumes queda como admin del grupo."
                : "Vas a quedar como admin y podés sumar a tus compañeros."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="g-nombre">Nombre del grupo</Label>
            <Input id="g-nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Los Prototipos" />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={cargando}>
              {cargando ? "Creando…" : "Crear grupo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
