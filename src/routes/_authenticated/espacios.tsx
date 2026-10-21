import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight, GraduationCap, KeyRound, LayoutGrid, Plus, School, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { espaciosQuery, mensajeError, ROL_LABEL } from "@/lib/gruplab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EstadoVacio } from "@/components/gruplab/EstadoVacio";

export const Route = createFileRoute("/_authenticated/espacios")({
  head: () => ({
    meta: [
      { title: "Mis espacios — GrupLab" },
      { name: "description", content: "Tus aulas y tableros en GrupLab." },
      { property: "og:title", content: "Mis espacios — GrupLab" },
      { property: "og:description", content: "Tus aulas y tableros en GrupLab." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(espaciosQuery()),
  component: Espacios,
});

type DialogoAbierto = null | "aula" | "tablero" | "codigo";

function Espacios() {
  const { data } = useSuspenseQuery(espaciosQuery());
  const [abierto, setAbierto] = useState<DialogoAbierto>(null);
  const docente = data.aulas.filter((a) => a.rol !== "alumno");
  const alumno = data.aulas.filter((a) => a.rol === "alumno");
  const vacio = data.aulas.length === 0 && data.tableros.length === 0;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Mis espacios</p>
          <h1 className="mt-1 text-4xl font-extrabold sm:text-5xl">¿En qué trabajamos hoy?</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAbierto("codigo")}>
            <KeyRound /> Unirme con código
          </Button>
          <Button variant="blue" onClick={() => setAbierto("tablero")}>
            <LayoutGrid /> Nuevo tablero
          </Button>
          <Button onClick={() => setAbierto("aula")}>
            <Plus /> Crear aula
          </Button>
        </div>
      </div>

      {vacio ? (
        <div className="mt-10">
          <EstadoVacio
            icon={School}
            titulo="Todavía no tenés espacios"
            texto="Si sos docente, creá un aula y compartí el código. Si sos alumno, pedile el código a tu docente."
          >
            <Button onClick={() => setAbierto("aula")}>
              <Plus /> Crear aula
            </Button>
            <Button variant="outline" onClick={() => setAbierto("codigo")}>
              <KeyRound /> Tengo un código
            </Button>
          </EstadoVacio>
        </div>
      ) : (
        <div className="mt-10 space-y-12">
          {docente.length > 0 && (
            <Seccion titulo="Como docente" icon={GraduationCap}>
              {docente.map((a, i) => (
                <AulaCard key={a.id} aula={a} acento={i} />
              ))}
            </Seccion>
          )}
          {alumno.length > 0 && (
            <Seccion titulo="Como alumno" icon={School}>
              {alumno.map((a, i) => (
                <AulaCard key={a.id} aula={a} acento={i + 1} />
              ))}
            </Seccion>
          )}
          <Seccion titulo="Tableros independientes" icon={LayoutGrid}>
            {data.tableros.map((t) => (
              <Link
                key={t.id}
                to="/grupos/$grupoId"
                params={{ grupoId: t.id }}
                className="brut brut-lift group flex flex-col rounded-2xl bg-card p-5"
              >
                <div className="flex items-start justify-between">
                  <span className="brut-sm grid h-10 w-10 place-items-center rounded-lg bg-mint">
                    <LayoutGrid className="h-5 w-5" />
                  </span>
                  <ArrowUpRight className="h-5 w-5 opacity-40 transition group-hover:opacity-100" />
                </div>
                <h3 className="mt-4 text-xl font-bold">{t.nombre}</h3>
                <p className="mt-1 font-mono text-xs text-muted-foreground">Código {t.codigo}</p>
              </Link>
            ))}
            <button
              onClick={() => setAbierto("tablero")}
              className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/40 text-sm font-semibold text-muted-foreground transition hover:border-ink hover:text-foreground"
            >
              <Plus className="h-5 w-5" /> Nuevo tablero personal
            </button>
          </Seccion>
        </div>
      )}

      <CrearAulaDialog open={abierto === "aula"} onClose={() => setAbierto(null)} />
      <CrearTableroDialog open={abierto === "tablero"} onClose={() => setAbierto(null)} />
      <UnirmeDialog open={abierto === "codigo"} onClose={() => setAbierto(null)} />
    </main>
  );
}

function Seccion({
  titulo,
  icon: Icon,
  children,
}: {
  titulo: string;
  icon: typeof School;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <Icon className="h-5 w-5" /> {titulo}
      </h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

const ACENTOS = ["bg-primary", "bg-secondary", "bg-sun", "bg-mint"];

function AulaCard({
  aula,
  acento,
}: {
  aula: { id: string; nombre: string; descripcion: string | null; rol: keyof typeof ROL_LABEL; miembros: number; grupos: number };
  acento: number;
}) {
  return (
    <Link
      to="/aulas/$aulaId"
      params={{ aulaId: aula.id }}
      className="brut brut-lift group flex flex-col overflow-hidden rounded-2xl bg-card"
    >
      <div className={`h-3 border-b-2 border-ink ${ACENTOS[acento % ACENTOS.length]}`} />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-bold leading-tight">{aula.nombre}</h3>
          <span className="shrink-0 rounded-full border-2 border-ink px-2 py-0.5 text-[11px] font-bold">
            {ROL_LABEL[aula.rol]}
          </span>
        </div>
        {aula.descripcion && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{aula.descripcion}</p>
        )}
        <div className="mt-auto flex items-center gap-4 pt-5 text-sm font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" /> {aula.miembros}
          </span>
          <span className="flex items-center gap-1.5">
            <LayoutGrid className="h-4 w-4" /> {aula.grupos} grupos
          </span>
          <ArrowUpRight className="ml-auto h-5 w-5 opacity-40 transition group-hover:opacity-100" />
        </div>
      </div>
    </Link>
  );
}

function CrearAulaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    const { data, error } = await supabase.rpc("crear_aula", { _nombre: nombre, _descripcion: descripcion });
    setCargando(false);
    if (error) return toast.error(mensajeError(error));
    await qc.invalidateQueries({ queryKey: ["espacios"] });
    toast.success("Aula creada. Compartí el código con tus alumnos.");
    onClose();
    setNombre("");
    setDescripcion("");
    navigate({ to: "/aulas/$aulaId", params: { aulaId: data as string } });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={crear} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Crear un aula</DialogTitle>
            <DialogDescription>Vas a quedar como admin y se genera un código de invitación.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="aula-nombre">Nombre de la materia</Label>
            <Input id="aula-nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Diseño de Interfaces 2026" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="aula-desc">Descripción (opcional)</Label>
            <Textarea id="aula-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Comisión, horario, consigna general…" />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={cargando}>{cargando ? "Creando…" : "Crear aula"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CrearTableroDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [nombre, setNombre] = useState("");
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    const { data, error } = await supabase.rpc("crear_tablero", { _nombre: nombre });
    setCargando(false);
    if (error) return toast.error(mensajeError(error));
    await qc.invalidateQueries({ queryKey: ["espacios"] });
    onClose();
    setNombre("");
    navigate({ to: "/grupos/$grupoId", params: { grupoId: data as string } });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={crear} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Nuevo tablero independiente</DialogTitle>
            <DialogDescription>Un Kanban propio, sin materia. Lo compartís con un código.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="tab-nombre">Nombre</Label>
            <Input id="tab-nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Tesis, Proyecto final…" />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="blue" disabled={cargando}>{cargando ? "Creando…" : "Crear tablero"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UnirmeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function unirme(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    const { data, error } = await supabase.rpc("unirse_con_codigo", { _codigo: codigo });
    setCargando(false);
    if (error) return toast.error(mensajeError(error));
    await qc.invalidateQueries({ queryKey: ["espacios"] });
    onClose();
    setCodigo("");
    const r = data as { tipo: "aula" | "tablero"; id: string };
    toast.success(r.tipo === "aula" ? "¡Te sumaste al aula!" : "¡Te sumaste al tablero!");
    if (r.tipo === "aula") navigate({ to: "/aulas/$aulaId", params: { aulaId: r.id } });
    else navigate({ to: "/grupos/$grupoId", params: { grupoId: r.id } });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={unirme} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Unirme con código</DialogTitle>
            <DialogDescription>Sirve para aulas y para tableros independientes.</DialogDescription>
          </DialogHeader>
          <Input
            required
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="ABC123"
            className="h-16 text-center font-mono text-3xl font-bold tracking-[0.4em] uppercase"
          />
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={cargando || codigo.length < 6}>{cargando ? "Uniendo…" : "Unirme"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
