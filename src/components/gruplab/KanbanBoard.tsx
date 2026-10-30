import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlarmClock, AlignLeft, CalendarDays, CheckCheck, Plus, Star, Users2, Weight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { ESTADOS, mensajeError, type Card, type Estado, type Perfil } from "@/lib/gruplab";
import { motivoNoCompletar, seAutoRevisa, type ContextoTablero } from "@/lib/reglasTareas";
import { estadoVencimiento } from "@/lib/vencimiento";
import { cn } from "@/lib/utils";
import { AvatarStack } from "./Avatar";

export function KanbanBoard({
  grupoId,
  cards,
  perfiles,
  puedeEditar,
  onAbrir,
  pendientesEval,
  contexto,
}: {
  grupoId: string;
  cards: Card[];
  perfiles: Record<string, Perfil | undefined>;
  puedeEditar: boolean;
  onAbrir: (card: Card) => void;
  pendientesEval: Set<string>;
  contexto: ContextoTablero;
}) {
  const qc = useQueryClient();
  const [arrastrando, setArrastrando] = useState<Card | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  async function mover(cardId: string, estado: Estado) {
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.estado === estado) return;
    let autoRevision = false;
    if (estado === "hecho") {
      const motivo = motivoNoCompletar(card, contexto);
      if (motivo) { toast.error(motivo); return; }
      autoRevision = seAutoRevisa(card, contexto);
    }
    const orden = Date.now();
    qc.setQueryData<Card[]>(["cards", grupoId], (old) =>
      old?.map((c) => (c.id === cardId ? { ...c, estado, orden } : c)),
    );
    const { error } = await supabase.from("cards").update({ estado, orden }).eq("id", cardId);
    if (error) {
      toast.error(mensajeError(error));
    } else if (autoRevision) {
      toast.success("Tarea completada. Quedó registrada tu revisión.");
    }
    qc.invalidateQueries({ queryKey: ["cards", grupoId] });
    qc.invalidateQueries({ queryKey: ["actividad", grupoId] });
  }

  function onDragStart(e: DragStartEvent) {
    setArrastrando(cards.find((c) => c.id === e.active.id) ?? null);
  }
  function onDragEnd(e: DragEndEvent) {
    setArrastrando(null);
    if (e.over) mover(String(e.active.id), e.over.id as Estado);
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setArrastrando(null)}>
      <div className="-mx-5 overflow-x-auto px-5 pb-4">
        <div className="grid min-w-[1040px] grid-cols-4 gap-4">
          {ESTADOS.map((col) => (
            <Columna
              key={col.id}
              estado={col}
              grupoId={grupoId}
              cards={cards.filter((c) => c.estado === col.id).sort((a, b) => a.orden - b.orden)}
              perfiles={perfiles}
              puedeEditar={puedeEditar}
              onAbrir={onAbrir}
              pendientesEval={pendientesEval}
            />
          ))}
        </div>
      </div>
      <DragOverlay>
        {arrastrando ? <CardItem card={arrastrando} perfiles={perfiles} flotando evaluar={false} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Columna({
  estado,
  grupoId,
  cards,
  perfiles,
  puedeEditar,
  onAbrir,
  pendientesEval,
}: {
  estado: (typeof ESTADOS)[number];
  grupoId: string;
  cards: Card[];
  perfiles: Record<string, Perfil | undefined>;
  puedeEditar: boolean;
  onAbrir: (c: Card) => void;
  pendientesEval: Set<string>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: estado.id, disabled: !puedeEditar });
  const [agregando, setAgregando] = useState(false);
  const [titulo, setTitulo] = useState("");
  const qc = useQueryClient();

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    const t = titulo.trim();
    if (!t) return;
    setTitulo("");
    const { error } = await supabase
      .from("cards")
      .insert({ grupo_id: grupoId, titulo: t, estado: estado.id, orden: Date.now() });
    if (error) { toast.error(mensajeError(error)); return; }
    qc.invalidateQueries({ queryKey: ["cards", grupoId] });
    qc.invalidateQueries({ queryKey: ["actividad", grupoId] });
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[420px] flex-col rounded-2xl border-2 border-ink p-3 transition-colors",
        estado.bg,
        isOver && "ring-4 ring-secondary/40",
      )}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="flex items-center gap-2 font-display text-base font-bold">
          <span className={`h-3 w-3 rounded-full border-2 border-ink ${estado.dot}`} />
          {estado.label}
        </h3>
        <span className="rounded-full border-2 border-ink bg-card px-2 text-xs font-bold">{cards.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2.5">
        {cards.map((c) => (
          <DraggableCard
            key={c.id}
            card={c}
            perfiles={perfiles}
            disabled={!puedeEditar}
            onAbrir={onAbrir}
            evaluar={pendientesEval.has(c.id)}
          />
        ))}
        {puedeEditar && estado.id !== "hecho" &&
          (agregando ? (
            <form onSubmit={crear} className="rounded-xl border-2 border-ink bg-card p-2">
              <textarea
                autoFocus
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) crear(e);
                  if (e.key === "Escape") setAgregando(false);
                }}
                onBlur={() => !titulo && setAgregando(false)}
                placeholder="¿Qué hay que hacer?"
                className="w-full resize-none bg-transparent text-sm outline-none"
                rows={2}
              />
              <div className="flex justify-end gap-1">
                <button type="button" onClick={() => setAgregando(false)} className="rounded-md px-2 py-1 text-xs font-semibold hover:bg-muted">
                  Cancelar
                </button>
                <button type="submit" className="rounded-md border-2 border-ink bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
                  Agregar
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setAgregando(true)}
              className="flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-card hover:text-foreground"
            >
              <Plus className="h-4 w-4" /> Agregar tarea
            </button>
          ))}
      </div>
    </div>
  );
}

function DraggableCard({
  card,
  perfiles,
  disabled,
  onAbrir,
  evaluar,
}: {
  card: Card;
  perfiles: Record<string, Perfil | undefined>;
  disabled: boolean;
  onAbrir: (c: Card) => void;
  evaluar: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id, disabled });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onAbrir(card)}
      className={cn("touch-manipulation", isDragging && "opacity-30")}
    >
      <CardItem card={card} perfiles={perfiles} evaluar={evaluar} />
    </div>
  );
}

function CardItem({
  card,
  perfiles,
  flotando,
  evaluar,
}: {
  card: Card;
  perfiles: Record<string, Perfil | undefined>;
  flotando?: boolean;
  evaluar: boolean;
}) {
  const venc = estadoVencimiento(card.fecha_limite, card.estado);
  return (
    <article
      className={cn(
        "cursor-pointer rounded-xl border-2 border-ink bg-card p-3 shadow-hard-sm transition hover:-translate-y-0.5 hover:shadow-hard",
        flotando && "rotate-2 shadow-hard-lg",
        venc === "vencida" && "border-destructive",
      )}
    >
      {venc && (
        <p
          className={cn(
            "mb-2 flex w-fit items-center gap-1 rounded-md border-2 border-ink px-1.5 text-[11px] font-bold",
            venc === "vencida" ? "bg-destructive text-destructive-foreground" : "bg-sun",
          )}
        >
          <AlarmClock className="h-3 w-3" /> {venc === "vencida" ? "Vencida" : "Vence pronto"}
        </p>
      )}
      <p className="text-sm font-semibold leading-snug">{card.titulo}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {card.descripcion && <AlignLeft className="h-3.5 w-3.5 text-muted-foreground" />}
        {card.fecha_limite && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            {format(new Date(`${card.fecha_limite}T12:00:00`), "d MMM", { locale: es })}
          </span>
        )}
        <span
          title="Esfuerzo"
          className="flex items-center gap-0.5 rounded-md border border-ink/30 px-1 text-[11px] font-bold"
        >
          <Weight className="h-3 w-3" /> {card.peso_esfuerzo}
        </span>
        {card.estado === "revision" && card.revisada_por && (
          <span className="flex items-center gap-1 rounded-md border-2 border-ink bg-mint px-1.5 text-[11px] font-bold">
            <CheckCheck className="h-3 w-3" /> Revisada
          </span>
        )}
        {card.puntuacion != null && (
          <span className="flex items-center gap-1 rounded-md border-2 border-ink bg-sun px-1.5 text-[11px] font-bold">
            <Star className="h-3 w-3" /> {card.puntuacion}/10
          </span>
        )}
        {evaluar && (
          <span className="flex items-center gap-1 rounded-md border-2 border-ink bg-secondary px-1.5 text-[11px] font-bold text-secondary-foreground">
            <Users2 className="h-3 w-3" /> Evaluá al equipo
          </span>
        )}
        <span className="ml-auto">
          {card.asignados.length > 0 ? (
            <AvatarStack ids={card.asignados} perfiles={perfiles as Record<string, { nombre: string } | undefined>} max={3} />
          ) : (
            <span className="text-[11px] text-muted-foreground">Sin responsable</span>
          )}
        </span>
      </div>
    </article>
  );
}
