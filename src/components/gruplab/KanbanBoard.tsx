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
import { AlignLeft, Plus, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ESTADOS, mensajeError, type Card, type Estado, type Perfil } from "@/lib/gruplab";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";

export function KanbanBoard({
  grupoId,
  cards,
  perfiles,
  puedeEditar,
  onAbrir,
}: {
  grupoId: string;
  cards: Card[];
  perfiles: Record<string, Perfil | undefined>;
  puedeEditar: boolean;
  onAbrir: (card: Card) => void;
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
    const orden = Date.now();
    qc.setQueryData<Card[]>(["cards", grupoId], (old) =>
      old?.map((c) => (c.id === cardId ? { ...c, estado, orden } : c)),
    );
    const { error } = await supabase.from("cards").update({ estado, orden }).eq("id", cardId);
    if (error) {
      toast.error(mensajeError(error));
      qc.invalidateQueries({ queryKey: ["cards", grupoId] });
    }
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
            />
          ))}
        </div>
      </div>
      <DragOverlay>
        {arrastrando ? <CardItem card={arrastrando} perfiles={perfiles} flotando /> : null}
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
}: {
  estado: (typeof ESTADOS)[number];
  grupoId: string;
  cards: Card[];
  perfiles: Record<string, Perfil | undefined>;
  puedeEditar: boolean;
  onAbrir: (c: Card) => void;
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
    if (error) return toast.error(mensajeError(error));
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
          <DraggableCard key={c.id} card={c} perfiles={perfiles} disabled={!puedeEditar} onAbrir={onAbrir} />
        ))}
        {puedeEditar &&
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
}: {
  card: Card;
  perfiles: Record<string, Perfil | undefined>;
  disabled: boolean;
  onAbrir: (c: Card) => void;
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
      <CardItem card={card} perfiles={perfiles} />
    </div>
  );
}

function CardItem({
  card,
  perfiles,
  flotando,
}: {
  card: Card;
  perfiles: Record<string, Perfil | undefined>;
  flotando?: boolean;
}) {
  return (
    <article
      className={cn(
        "cursor-pointer rounded-xl border-2 border-ink bg-card p-3 shadow-hard-sm transition hover:-translate-y-0.5 hover:shadow-hard",
        flotando && "rotate-2 shadow-hard-lg",
      )}
    >
      <p className="text-sm font-semibold leading-snug">{card.titulo}</p>
      <div className="mt-2.5 flex items-center gap-2">
        {card.descripcion && <AlignLeft className="h-3.5 w-3.5 text-muted-foreground" />}
        {card.puntuacion != null && (
          <span className="flex items-center gap-1 rounded-md border-2 border-ink bg-sun px-1.5 text-[11px] font-bold">
            <Star className="h-3 w-3" /> {card.puntuacion}/10
          </span>
        )}
        {card.creado_por && (
          <Avatar id={card.creado_por} nombre={perfiles[card.creado_por]?.nombre} size="sm" className="ml-auto h-6 w-6" />
        )}
      </div>
    </article>
  );
}
