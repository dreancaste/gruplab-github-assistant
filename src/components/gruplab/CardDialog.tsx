import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Download, FileText, Loader2, Paperclip, Star, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  adjuntosQuery,
  ESTADOS,
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
import { cn } from "@/lib/utils";

export function CardDialog({
  card,
  onClose,
  grupoId,
  uid,
  esStaff,
  puedeEditar,
  puedeGestionar,
  perfiles,
}: {
  card: Card | null;
  onClose: () => void;
  grupoId: string;
  uid: string;
  esStaff: boolean;
  puedeEditar: boolean;
  puedeGestionar: boolean;
  perfiles: Record<string, Perfil | undefined>;
}) {
  return (
    <Dialog open={!!card} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
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
}: {
  card: Card;
  onClose: () => void;
  grupoId: string;
  uid: string;
  esStaff: boolean;
  puedeEditar: boolean;
  puedeGestionar: boolean;
  perfiles: Record<string, Perfil | undefined>;
}) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState(card.titulo);
  const [descripcion, setDescripcion] = useState(card.descripcion ?? "");
  const [puntuacion, setPuntuacion] = useState<number | null>(card.puntuacion);
  const [comentario, setComentario] = useState(card.comentario_profesor ?? "");
  const [guardando, setGuardando] = useState(false);
  const cambios = titulo !== card.titulo || descripcion !== (card.descripcion ?? "");

  function refrescar() {
    qc.invalidateQueries({ queryKey: ["cards", grupoId] });
    qc.invalidateQueries({ queryKey: ["actividad", grupoId] });
  }

  async function actualizar(patch: Partial<Card>, ok?: string) {
    setGuardando(true);
    const { error } = await supabase.from("cards").update(patch).eq("id", card.id);
    setGuardando(false);
    if (error) return toast.error(mensajeError(error));
    if (ok) toast.success(ok);
    refrescar();
  }

  async function eliminar() {
    if (!confirm("¿Eliminar esta tarea? No se puede deshacer.")) return;
    const { error } = await supabase.from("cards").delete().eq("id", card.id);
    if (error) return toast.error(mensajeError(error));
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
            onClick={() => actualizar({ estado: e.id as Estado, orden: Date.now() })}
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
        const up = await supabase.storage.from("adjuntos").upload(path, file, { contentType: file.type || undefined });
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
    if (error || !data) return toast.error("No pudimos abrir el archivo");
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function borrar(id: string, path: string) {
    if (!confirm("¿Eliminar este archivo?")) return;
    const { error } = await supabase.from("card_adjuntos").delete().eq("id", id);
    if (error) return toast.error(mensajeError(error));
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
              <FileText className="h-5 w-5 shrink-0 text-secondary" />
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
    </section>
  );
}
