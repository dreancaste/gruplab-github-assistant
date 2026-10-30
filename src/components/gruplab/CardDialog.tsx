import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarDays,
  Check,
  CheckCheck,
  Download,
  FileText,
  Loader2,
  Lock,
  Paperclip,
  Star,
  Trash2,
  Upload,
  Users2,
  Weight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  adjuntosQuery,
  ESFUERZOS,
  ESTADOS,
  type EvaluacionPar,
  formatoTamano,
  mensajeError,
  type Card,
  type Estado,
  type Perfil,
} from "@/lib/gruplab";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar } from "./Avatar";
import {
  esTableroIndividual,
  motivoNoCompletar,
  puedeRevisar,
  seAutoRevisa,
  todoElGrupoAsignado,
  type ContextoTablero,
} from "@/lib/reglasTareas";
import { estadoVencimiento } from "@/lib/vencimiento";
import { cn } from "@/lib/utils";

type Extra = {
  integrantes: string[];
  esMiembro: boolean;
  esIndependiente: boolean;
  misEvaluaciones: EvaluacionPar[];
};

export function CardDialog({
  card,
  onClose,
  grupoId,
  uid,
  esStaff,
  puedeEditar,
  puedeGestionar,
  perfiles,
  ...extra
}: {
  card: Card | null;
  onClose: () => void;
  grupoId: string;
  uid: string;
  esStaff: boolean;
  puedeEditar: boolean;
  puedeGestionar: boolean;
  perfiles: Record<string, Perfil | undefined>;
} & Extra) {
  return (
    <Dialog open={!!card} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        {card && (
          <Contenido
            key={card.id}
            card={card}
            onClose={onClose}
            grupoId={grupoId}
            uid={uid}
            esStaff={esStaff}
            puedeEditar={puedeEditar}
            puedeGestionar={puedeGestionar}
            perfiles={perfiles}
            {...extra}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Contenido({
  card,
  onClose,
  grupoId,
  uid,
  esStaff,
  puedeEditar,
  puedeGestionar,
  perfiles,
  integrantes,
  esMiembro,
  esIndependiente,
  misEvaluaciones,
}: {
  card: Card;
  onClose: () => void;
  grupoId: string;
  uid: string;
  esStaff: boolean;
  puedeEditar: boolean;
  puedeGestionar: boolean;
  perfiles: Record<string, Perfil | undefined>;
} & Extra) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState(card.titulo);
  const [descripcion, setDescripcion] = useState(card.descripcion ?? "");
  const [puntuacion, setPuntuacion] = useState<number | null>(card.puntuacion);
  const [comentario, setComentario] = useState(card.comentario_profesor ?? "");
  const [guardando, setGuardando] = useState(false);
  const cambios = titulo !== card.titulo || descripcion !== (card.descripcion ?? "");
  const contexto: ContextoTablero = { esIndependiente, integrantes, uid, esStaff };


  function refrescar() {
    qc.invalidateQueries({ queryKey: ["cards", grupoId] });
    qc.invalidateQueries({ queryKey: ["actividad", grupoId] });
  }

  async function actualizar(patch: Partial<Card>, ok?: string) {
    setGuardando(true);
    const { error } = await supabase.from("cards").update(patch).eq("id", card.id);
    setGuardando(false);
    if (error) { toast.error(mensajeError(error)); return; }
    if (ok) toast.success(ok);
    refrescar();
  }

  async function eliminar() {
    if (!confirm("¿Eliminar esta tarea? No se puede deshacer.")) return;
    const { error } = await supabase.from("cards").delete().eq("id", card.id);
    if (error) { toast.error(mensajeError(error)); return; }
    refrescar();
    onClose();
  }

  return (
    <div className="grid gap-5">
      <DialogHeader>
        <DialogDescription className="flex items-center gap-2 text-xs">
          {card.creado_por && (
            <>
              <Avatar id={card.creado_por} nombre={perfiles[card.creado_por]?.nombre} size="sm" />
              Creada por {perfiles[card.creado_por]?.nombre ?? "alguien"} ·{" "}
            </>
          )}
          {format(new Date(card.created_at), "d MMM yyyy", { locale: es })}
        </DialogDescription>
        <DialogTitle className="sr-only">{card.titulo}</DialogTitle>
        {puedeEditar ? (
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="h-auto border-transparent bg-transparent px-1 font-display text-2xl font-bold hover:border-ink/30 focus-visible:border-ink"
          />
        ) : (
          <h2 className="font-display text-2xl font-bold">{card.titulo}</h2>
        )}
      </DialogHeader>

      <div className="flex flex-wrap gap-2">
        {ESTADOS.map((e) => (
          <button
            key={e.id}
            disabled={!puedeEditar || guardando}
            onClick={() => {
              if (e.id === card.estado) return;
              let ok: string | undefined;
              if (e.id === "hecho") {
                const motivo = motivoNoCompletar(card, contexto);
                if (motivo) { toast.error(motivo); return; }
                if (seAutoRevisa(card, contexto)) ok = "Tarea completada. Quedó registrada tu revisión.";
              }
              actualizar({ estado: e.id as Estado, orden: Date.now() }, ok);
            }}
            className={cn(
              "flex items-center gap-2 rounded-full border-2 border-ink px-3 py-1 text-xs font-bold transition",
              card.estado === e.id ? "bg-ink text-paper" : "bg-card hover:bg-muted",
            )}
          >
            <span className={`h-2.5 w-2.5 rounded-full border border-ink ${e.dot}`} /> {e.label}
          </button>
        ))}
      </div>

      <div className="grid gap-1.5">
        <Label>Descripción</Label>
        {puedeEditar ? (
          <Textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={4}
            placeholder="Detalles, criterios de aceptación, links…"
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{card.descripcion || "Sin descripción."}</p>
        )}
        {puedeEditar && cambios && (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTitulo(card.titulo);
                setDescripcion(card.descripcion ?? "");
              }}
            >
              Descartar
            </Button>
            <Button
              size="sm"
              disabled={guardando || !titulo.trim()}
              onClick={() => actualizar({ titulo: titulo.trim(), descripcion: descripcion || null }, "Cambios guardados")}
            >
              Guardar cambios
            </Button>
          </div>
        )}
      </div>

      <Planificacion
        card={card}
        esStaff={esStaff}
        puedeEditar={puedeEditar}
        integrantes={integrantes}
        perfiles={perfiles}
        guardando={guardando}
        actualizar={actualizar}
      />

      <Revision card={card} uid={uid} contexto={contexto} perfiles={perfiles} guardando={guardando} actualizar={actualizar} />

      {card.estado === "hecho" && esMiembro && (
        <EvaluacionPares card={card} uid={uid} integrantes={integrantes} perfiles={perfiles} misEvaluaciones={misEvaluaciones} />
      )}

      <Adjuntos card={card} grupoId={grupoId} uid={uid} puedeSubir={puedeEditar} puedeGestionar={puedeGestionar} perfiles={perfiles} />

      <section className="rounded-2xl border-2 border-ink bg-sun/25 p-4">
        <h3 className="flex items-center gap-2 font-display text-base font-bold">
          <Star className="h-4 w-4" /> Evaluación docente
        </h3>
        {esStaff ? (
          <div className="mt-3 grid gap-3">
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 11 }).map((_, n) => (
                <button
                  key={n}
                  onClick={() => setPuntuacion(puntuacion === n ? null : n)}
                  className={cn(
                    "h-9 w-9 rounded-lg border-2 border-ink font-mono text-sm font-bold transition",
                    puntuacion === n ? "bg-ink text-paper" : "bg-card hover:bg-muted",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <Textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Comentario para el grupo…"
              rows={2}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ink"
                disabled={guardando || (puntuacion === card.puntuacion && comentario === (card.comentario_profesor ?? ""))}
                onClick={() =>
                  actualizar({ puntuacion, comentario_profesor: comentario || null }, "Evaluación guardada")
                }
              >
                Guardar evaluación
              </Button>
            </div>
          </div>
        ) : card.puntuacion != null || card.comentario_profesor ? (
          <div className="mt-2">
            {card.puntuacion != null && (
              <p className="font-display text-3xl font-extrabold">
                {card.puntuacion}
                <span className="text-base text-muted-foreground">/10</span>
              </p>
            )}
            {card.comentario_profesor && <p className="mt-1 text-sm">“{card.comentario_profesor}”</p>}
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">El docente todavía no evaluó esta tarea.</p>
        )}
      </section>

      {puedeEditar && (
        <div className="flex justify-between border-t-2 border-ink/10 pt-4">
          <Button variant="ghost" size="sm" className="text-destructive" onClick={eliminar}>
            <Trash2 /> Eliminar tarea
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      )}
    </div>
  );
}

type Actualizar = (patch: Partial<Card>, ok?: string) => Promise<void>;

function Planificacion({
  card,
  esStaff,
  puedeEditar,
  integrantes,
  perfiles,
  guardando,
  actualizar,
}: {
  card: Card;
  esStaff: boolean;
  puedeEditar: boolean;
  integrantes: string[];
  perfiles: Record<string, Perfil | undefined>;
  guardando: boolean;
  actualizar: Actualizar;
}) {
  const congelada = !esStaff && card.estado !== "backlog" && card.asignados.length > 0;
  const puedePlanificar = puedeEditar && !congelada && !guardando;
  const venc = estadoVencimiento(card.fecha_limite, card.estado);
  // Los responsables se eligen primero y se guardan juntos: si la tarea ya arrancó,
  // guardar de a uno congelaría la asignación después del primer clic.
  const [borrador, setBorrador] = useState<string[]>(card.asignados);
  const asignadosKey = card.asignados.join(",");
  useEffect(() => {
    setBorrador(card.asignados);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asignadosKey]);
  const cambioAsignados =
    borrador.length !== card.asignados.length || borrador.some((id) => !card.asignados.includes(id));
  const seCongela = !esStaff && card.estado !== "backlog";

  function alternar(id: string) {
    setBorrador((b) => (b.includes(id) ? b.filter((x) => x !== id) : [...b, id]));
  }

  async function guardarAsignados() {
    if (seCongela && borrador.length > 0 &&
      !confirm("La tarea ya arrancó: después de guardar no vas a poder cambiar los responsables. ¿Guardar?")) return;
    await actualizar({ asignados: borrador }, "Responsables guardados");
  }

  return (
    <section className="grid gap-4 rounded-2xl border-2 border-ink p-4 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <Label className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4" /> Fecha límite
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={card.fecha_limite ?? ""}
            disabled={!puedeEditar || guardando}
            onChange={(e) => actualizar({ fecha_limite: e.target.value || null })}
            className="w-44"
          />
          {venc && (
            <span
              className={cn(
                "rounded-md border-2 border-ink px-1.5 text-[11px] font-bold",
                venc === "vencida" ? "bg-destructive text-destructive-foreground" : "bg-sun",
              )}
            >
              {venc === "vencida" ? "Vencida" : "Vence pronto"}
            </span>
          )}
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label className="flex items-center gap-1.5">
          <Weight className="h-4 w-4" /> Esfuerzo
        </Label>
        <div className="flex gap-1.5">
          {ESFUERZOS.map((e) => (
            <button
              key={e.valor}
              disabled={!puedePlanificar}
              onClick={() => card.peso_esfuerzo !== e.valor && actualizar({ peso_esfuerzo: e.valor })}
              className={cn(
                "rounded-lg border-2 border-ink px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed",
                card.peso_esfuerzo === e.valor ? "bg-ink text-paper" : "bg-card hover:bg-muted disabled:opacity-60",
              )}
            >
              {e.label} · {e.valor}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label className="flex items-center gap-1.5">
          <Users2 className="h-4 w-4" /> Responsables
        </Label>
        {integrantes.length === 0 ? (
          <p className="text-sm text-muted-foreground">El grupo todavía no tiene integrantes.</p>
        ) : (
          <>
            {puedePlanificar && (
              <p className="text-xs text-muted-foreground">Tocá una o más personas y después guardá.</p>
            )}
            <div className="flex flex-wrap gap-2">
              {integrantes.map((id) => {
                const activo = borrador.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={activo}
                    disabled={!puedePlanificar}
                    onClick={() => alternar(id)}
                    className={cn(
                      "flex items-center gap-2 rounded-full border-2 border-ink py-0.5 pl-0.5 pr-3 text-sm font-semibold transition disabled:cursor-not-allowed",
                      activo ? "bg-secondary text-secondary-foreground" : "bg-card hover:bg-muted disabled:opacity-60",
                    )}
                  >
                    <Avatar id={id} nombre={perfiles[id]?.nombre} size="sm" />
                    {perfiles[id]?.nombre ?? "Integrante"}
                    {activo && <Check className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
            {puedePlanificar && cambioAsignados && (
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setBorrador(card.asignados)}>
                  Descartar
                </Button>
                <Button type="button" size="sm" disabled={guardando} onClick={guardarAsignados}>
                  Guardar responsables
                </Button>
              </div>
            )}
          </>
        )}
        {congelada && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" /> El esfuerzo y los responsables se congelan al iniciar la tarea para proteger la
            métrica de participación.
          </p>
        )}
      </div>
    </section>
  );
}

function Revision({
  card,
  uid,
  contexto,
  perfiles,
  guardando,
  actualizar,
}: {
  card: Card;
  uid: string;
  contexto: ContextoTablero;
  perfiles: Record<string, Perfil | undefined>;
  guardando: boolean;
  actualizar: Actualizar;
}) {
  if (card.estado !== "revision") return null;
  const individual = esTableroIndividual(contexto);
  const habilitado = puedeRevisar(card, contexto);
  const todos = todoElGrupoAsignado(card, contexto.integrantes);
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-ink bg-sun/25 p-4">
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 font-display text-base font-bold">
          <CheckCheck className="h-4 w-4" /> Revisión
        </h3>
        {card.revisada_por ? (
          <p className="mt-1 text-sm">
            Revisada por{" "}
            <strong>{perfiles[card.revisada_por]?.nombre ?? (contexto.integrantes.includes(card.revisada_por) ? "un integrante" : "el docente")}</strong>
            {card.revisada_en && ` · ${format(new Date(card.revisada_en), "d MMM HH:mm", { locale: es })}`}. Ya se puede
            pasar a Hecho.
          </p>
        ) : individual ? (
          <p className="mt-1 text-sm text-muted-foreground">
            En un tablero individual no hace falta revisión: podés pasarla a Hecho directamente.
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            {todos
              ? "Todo el grupo está asignado, así que cualquier integrante (o el docente) puede revisarla."
              : "Otra persona del grupo que no esté asignada, o el docente, tiene que revisarla antes de pasarla a Hecho."}
          </p>
        )}
      </div>
      {!card.revisada_por && habilitado && (
        <Button size="sm" variant="ink" disabled={guardando} onClick={() => actualizar({ revisada_por: uid }, "Revisión registrada")}>
          <CheckCheck /> Marcar como revisada
        </Button>
      )}
    </section>
  );
}

const CRITERIOS = [
  { id: "coordinacion", label: "Coordinación" },
  { id: "comunicacion", label: "Comunicación" },
  { id: "responsabilidad", label: "Responsabilidad" },
] as const;

function EvaluacionPares({
  card,
  uid,
  integrantes,
  perfiles,
  misEvaluaciones,
}: {
  card: Card;
  uid: string;
  integrantes: string[];
  perfiles: Record<string, Perfil | undefined>;
  misEvaluaciones: EvaluacionPar[];
}) {
  const qc = useQueryClient();
  const otros = integrantes.filter((id) => id !== uid);
  const previa = (id: string) => misEvaluaciones.find((e) => e.card_id === card.id && e.evaluado_id === id);
  const pendientes = otros.filter((id) => !previa(id));
  const notasDe = (id: string) => {
    const p = previa(id);
    return p
      ? { coordinacion: p.coordinacion, comunicacion: p.comunicacion, responsabilidad: p.responsabilidad }
      : { coordinacion: 5, comunicacion: 5, responsabilidad: 5 };
  };
  const inicial = pendientes[0] ?? otros[0] ?? "";
  const [evaluado, setEvaluado] = useState(inicial);
  const [notas, setNotas] = useState(() => notasDe(inicial));
  const [enviando, setEnviando] = useState(false);
  const actual = otros.includes(evaluado) ? evaluado : inicial;

  if (otros.length === 0) return null;

  function elegir(id: string) {
    setEvaluado(id);
    setNotas(notasDe(id));
  }

  async function enviar() {
    if (!actual) return;
    const yaEvaluado = !!previa(actual);
    setEnviando(true);
    const { error } = await supabase.rpc("evaluar_par", {
      _card_id: card.id,
      _evaluado_id: actual,
      _coordinacion: notas.coordinacion,
      _comunicacion: notas.comunicacion,
      _responsabilidad: notas.responsabilidad,
    });
    setEnviando(false);
    if (error) { toast.error(mensajeError(error)); return; }
    const nombre = perfiles[actual]?.nombre ?? "tu compañero";
    toast.success(yaEvaluado ? `Actualizaste tu evaluación de ${nombre}` : `Evaluaste a ${nombre}`);
    const siguiente = pendientes.find((id) => id !== actual);
    if (siguiente) elegir(siguiente);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["mis-evaluaciones", card.grupo_id] }),
      qc.invalidateQueries({ queryKey: ["pares"] }),
    ]);
  }

  return (
    <section className="rounded-2xl border-2 border-ink bg-secondary/10 p-4">
      <h3 className="flex items-center gap-2 font-display text-base font-bold">
        <Users2 className="h-4 w-4" /> Evaluación entre pares
      </h3>
      {(
        <div className="mt-3 grid gap-3">
          <p className="text-sm text-muted-foreground">
            {pendientes.length === 0
              ? "Ya evaluaste a todo el equipo en esta tarea. Si querés, podés cambiar tu evaluación."
              : "Puntuá del 1 al 5 cómo trabajó cada compañero en esta tarea. Es anónimo: el grupo solo ve el promedio."}
          </p>
          <div className="flex flex-wrap gap-2">
            {otros.map((id) => (
              <button
                key={id}
                onClick={() => elegir(id)}
                className={cn(
                  "flex items-center gap-2 rounded-full border-2 border-ink py-0.5 pl-0.5 pr-3 text-sm font-semibold",
                  actual === id ? "bg-ink text-paper" : "bg-card hover:bg-muted",
                )}
              >
                <Avatar id={id} nombre={perfiles[id]?.nombre} size="sm" />
                {perfiles[id]?.nombre ?? "Integrante"}
                {previa(id) && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
          {CRITERIOS.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">{c.label}</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setNotas((v) => ({ ...v, [c.id]: n }))}
                    className={cn(
                      "h-8 w-8 rounded-lg border-2 border-ink font-mono text-sm font-bold",
                      notas[c.id] === n ? "bg-secondary text-secondary-foreground" : "bg-card hover:bg-muted",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="flex justify-end">
            <Button size="sm" disabled={enviando || !actual} onClick={enviar}>
              {enviando && <Loader2 className="animate-spin" />} {previa(actual) ? "Actualizar evaluación" : "Enviar evaluación"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function Adjuntos({
  card,
  grupoId,
  uid,
  puedeSubir,
  puedeGestionar,
  perfiles,
}: {
  card: Card;
  grupoId: string;
  uid: string;
  puedeSubir: boolean;
  puedeGestionar: boolean;
  perfiles: Record<string, Perfil | undefined>;
}) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const { data: adjuntos = [], isLoading } = useQuery(adjuntosQuery(card.id));
  const [vista, setVista] = useState<{ url: string; nombre: string } | null>(null);
  const imagenes = adjuntos.filter((a) => a.tipo?.startsWith("image/")).map((a) => a.path);
  const { data: urls = {} } = useQuery({
    queryKey: ["adjuntos-urls", card.id, imagenes],
    enabled: imagenes.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("adjuntos").createSignedUrls(imagenes, 3600);
      if (error) throw error;
      return Object.fromEntries((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl]));
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`adjuntos-${card.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "card_adjuntos", filter: `card_id=eq.${card.id}` }, () =>
        qc.invalidateQueries({ queryKey: ["adjuntos", card.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [card.id, qc]);

  async function subir(files: FileList | null) {
    if (!files?.length) return;
    setSubiendo(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`${file.name} supera los 20 MB`);
          continue;
        }
        const limpio = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${grupoId}/${card.id}/${Date.now()}-${limpio}`;
        const up = await supabase.storage.from("adjuntos").upload(path, file, file.type ? { contentType: file.type } : {});
        if (up.error) throw up.error;
        const { error } = await supabase.from("card_adjuntos").insert({
          card_id: card.id,
          grupo_id: grupoId,
          path,
          nombre: file.name,
          tamano: file.size,
          tipo: file.type || null,
          subido_por: uid,
        });
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["adjuntos", card.id] });
      qc.invalidateQueries({ queryKey: ["actividad", grupoId] });
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
    }
  }

  async function descargar(path: string, nombre: string) {
    const { data, error } = await supabase.storage.from("adjuntos").createSignedUrl(path, 60, { download: nombre });
    if (error || !data) { toast.error("No pudimos abrir el archivo"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function borrar(id: string, path: string) {
    if (!confirm("¿Eliminar este archivo?")) return;
    const { error } = await supabase.from("card_adjuntos").delete().eq("id", id);
    if (error) { toast.error(mensajeError(error)); return; }
    await supabase.storage.from("adjuntos").remove([path]);
    qc.invalidateQueries({ queryKey: ["adjuntos", card.id] });
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <Paperclip className="h-4 w-4" /> Archivos ({adjuntos.length})
        </Label>
        {puedeSubir && (
          <>
            <input ref={input} type="file" multiple hidden onChange={(e) => subir(e.target.files)} />
            <Button size="sm" variant="outline" disabled={subiendo} onClick={() => input.current?.click()}>
              {subiendo ? <Loader2 className="animate-spin" /> : <Upload />} Subir
            </Button>
          </>
        )}
      </div>
      {isLoading ? (
        <p className="mt-2 text-sm text-muted-foreground">Cargando…</p>
      ) : adjuntos.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Sin archivos adjuntos.</p>
      ) : (
        <ul className="mt-2 grid gap-2">
          {adjuntos.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-xl border-2 border-ink bg-card px-3 py-2">
              {urls[a.path] ? (
                <button
                  title="Ver imagen"
                  onClick={() => setVista({ url: urls[a.path]!, nombre: a.nombre })}
                  className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 border-ink"
                >
                  <img src={urls[a.path] ?? undefined} alt={a.nombre} className="h-full w-full object-cover" loading="lazy" />
                </button>
              ) : (
                <FileText className="h-5 w-5 shrink-0 text-secondary" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{a.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {formatoTamano(a.tamano)} · {perfiles[a.subido_por]?.nombre ?? "alguien"}
                </p>
              </div>
              <Button size="icon" variant="ghost" title="Descargar" onClick={() => descargar(a.path, a.nombre)}>
                <Download />
              </Button>
              {(a.subido_por === uid || puedeGestionar) && (
                <Button size="icon" variant="ghost" title="Eliminar" onClick={() => borrar(a.id, a.path)}>
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!vista} onOpenChange={(o) => !o && setVista(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-6 text-base">{vista?.nombre}</DialogTitle>
          </DialogHeader>
          {vista && (
            <img src={vista.url} alt={vista.nombre} className="max-h-[75vh] w-full rounded-xl border-2 border-ink object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
