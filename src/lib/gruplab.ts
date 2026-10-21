import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Rol = Database["public"]["Enums"]["rol_aula"];
export type Estado = Database["public"]["Enums"]["estado_card"];
export type Aula = Database["public"]["Tables"]["aulas"]["Row"];
export type Grupo = Database["public"]["Tables"]["grupos"]["Row"];
export type Card = Database["public"]["Tables"]["cards"]["Row"];
export type Adjunto = Database["public"]["Tables"]["card_adjuntos"]["Row"];
export type Actividad = Database["public"]["Tables"]["actividad"]["Row"];
export type Perfil = Database["public"]["Tables"]["profiles"]["Row"];

export const ESTADOS: { id: Estado; label: string; dot: string; bg: string }[] = [
  { id: "backlog", label: "Backlog", dot: "bg-estado-backlog", bg: "bg-muted" },
  { id: "progreso", label: "En progreso", dot: "bg-estado-progreso", bg: "bg-secondary/10" },
  { id: "revision", label: "Revisión", dot: "bg-estado-revision", bg: "bg-sun/20" },
  { id: "hecho", label: "Hecho", dot: "bg-estado-hecho", bg: "bg-mint/15" },
];

export const ROL_LABEL: Record<Rol, string> = {
  admin: "Admin",
  profesor: "Docente",
  alumno: "Alumno",
};

export function mensajeError(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: string }).message);
  return "Algo salió mal";
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function miUsuarioId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Sesión expirada");
  return id;
}

async function perfiles(ids: string[]): Promise<Record<string, Perfil>> {
  const unicos = Array.from(new Set(ids.filter(Boolean)));
  if (unicos.length === 0) return {};
  const rows = check(await supabase.from("profiles").select("*").in("id", unicos));
  return Object.fromEntries((rows ?? []).map((p) => [p.id, p]));
}

export function iniciales(nombre?: string | null) {
  const n = (nombre ?? "?").trim();
  const parts = n.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

// ============ Mis espacios ============
export const espaciosQuery = () =>
  queryOptions({
    queryKey: ["espacios"],
    queryFn: async () => {
      const uid = await miUsuarioId();
      const misAulas = check(
        await supabase.from("aula_miembros").select("rol, aula_id, aulas(*)").eq("user_id", uid),
      );
      const aulaIds = misAulas.map((m) => m.aula_id);
      const [conteoMiembros, grupos, misGrupos] = await Promise.all([
        aulaIds.length
          ? supabase.from("aula_miembros").select("aula_id").in("aula_id", aulaIds)
          : Promise.resolve({ data: [], error: null }),
        aulaIds.length
          ? supabase.from("grupos").select("id, aula_id").in("aula_id", aulaIds)
          : Promise.resolve({ data: [], error: null }),
        supabase.from("grupo_miembros").select("grupo_id, grupos(*)").eq("user_id", uid),
      ]);
      const miembrosPorAula = new Map<string, number>();
      for (const r of conteoMiembros.data ?? []) {
        miembrosPorAula.set(r.aula_id, (miembrosPorAula.get(r.aula_id) ?? 0) + 1);
      }
      const gruposPorAula = new Map<string, number>();
      for (const g of grupos.data ?? []) {
        if (g.aula_id) gruposPorAula.set(g.aula_id, (gruposPorAula.get(g.aula_id) ?? 0) + 1);
      }
      const aulas = misAulas
        .filter((m) => m.aulas)
        .map((m) => ({
          ...(m.aulas as Aula),
          rol: m.rol,
          miembros: miembrosPorAula.get(m.aula_id) ?? 0,
          grupos: gruposPorAula.get(m.aula_id) ?? 0,
        }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      const tableros = (misGrupos.data ?? [])
        .map((m) => m.grupos as Grupo | null)
        .filter((g): g is Grupo => !!g && g.es_independiente);
      return { aulas, tableros };
    },
  });

// ============ Aula ============
export const aulaQuery = (aulaId: string) =>
  queryOptions({
    queryKey: ["aula", aulaId],
    queryFn: async () => {
      const uid = await miUsuarioId();
      const aula = check(await supabase.from("aulas").select("*").eq("id", aulaId).maybeSingle());
      if (!aula) throw new Error("No encontramos esta aula o no participás de ella");
      const [miembros, grupos, gm] = await Promise.all([
        supabase.from("aula_miembros").select("*").eq("aula_id", aulaId),
        supabase.from("grupos").select("*").eq("aula_id", aulaId).order("created_at"),
        supabase.from("grupo_miembros").select("*").eq("aula_id", aulaId),
      ]);
      const miembrosRows = check(miembros);
      const gruposRows = check(grupos);
      const gmRows = check(gm);
      const rol = miembrosRows.find((m) => m.user_id === uid)?.rol ?? null;
      const esStaff = rol === "admin" || rol === "profesor";
      const grupoIds = gruposRows.map((g) => g.id);
      const cards =
        grupoIds.length > 0
          ? check(
              await supabase
                .from("cards")
                .select("grupo_id, estado, puntuacion")
                .in("grupo_id", grupoIds),
            )
          : [];
      const perfs = await perfiles(miembrosRows.map((m) => m.user_id));
      return {
        uid,
        aula,
        rol,
        esStaff,
        perfiles: perfs,
        miembros: miembrosRows,
        grupos: gruposRows.map((g) => {
          const cs = cards.filter((c) => c.grupo_id === g.id);
          const puntuadas = cs.filter((c) => c.puntuacion != null);
          return {
            ...g,
            integrantes: gmRows.filter((m) => m.grupo_id === g.id).map((m) => m.user_id),
            totalCards: cs.length,
            hechas: cs.filter((c) => c.estado === "hecho").length,
            promedio:
              puntuadas.length > 0
                ? puntuadas.reduce((s, c) => s + (c.puntuacion ?? 0), 0) / puntuadas.length
                : null,
          };
        }),
        miGrupoId: gmRows.find((m) => m.user_id === uid)?.grupo_id ?? null,
      };
    },
  });

export const aulaActividadQuery = (aulaId: string, grupoIds: string[]) =>
  queryOptions({
    queryKey: ["aula-actividad", aulaId, grupoIds],
    queryFn: async () => {
      if (grupoIds.length === 0) return [];
      return check(
        await supabase
          .from("actividad")
          .select("*")
          .in("grupo_id", grupoIds)
          .order("created_at", { ascending: false })
          .limit(1000),
      );
    },
  });

// ============ Grupo ============
export const grupoQuery = (grupoId: string) =>
  queryOptions({
    queryKey: ["grupo", grupoId],
    queryFn: async () => {
      const uid = await miUsuarioId();
      const grupo = check(await supabase.from("grupos").select("*").eq("id", grupoId).maybeSingle());
      if (!grupo) throw new Error("No encontramos este grupo o no tenés acceso");
      const [gm, aula, aulaMiembros] = await Promise.all([
        supabase.from("grupo_miembros").select("*").eq("grupo_id", grupoId).order("created_at"),
        grupo.aula_id
          ? supabase.from("aulas").select("*").eq("id", grupo.aula_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        grupo.aula_id
          ? supabase.from("aula_miembros").select("*").eq("aula_id", grupo.aula_id)
          : Promise.resolve({ data: [], error: null }),
      ]);
      const integrantes = check(gm).map((m) => m.user_id);
      const am = aulaMiembros.data ?? [];
      let ocupados: string[] = [];
      if (grupo.aula_id) {
        const r = check(
          await supabase.from("grupo_miembros").select("user_id").eq("aula_id", grupo.aula_id),
        );
        ocupados = r.map((x) => x.user_id);
      }
      const rolAula = am.find((m) => m.user_id === uid)?.rol ?? null;
      const esStaff = rolAula === "admin" || rolAula === "profesor";
      const esMiembro = integrantes.includes(uid);
      const perfs = await perfiles([...integrantes, ...am.map((m) => m.user_id)]);
      return {
        uid,
        grupo,
        aula: aula.data as Aula | null,
        integrantes,
        perfiles: perfs,
        rolAula,
        esStaff,
        esMiembro,
        esAdminGrupo: grupo.admin_id === uid,
        puedeGestionar: grupo.admin_id === uid || esStaff,
        alumnosLibres: am
          .filter((m) => m.rol === "alumno" && !ocupados.includes(m.user_id))
          .map((m) => m.user_id),
      };
    },
  });

export const cardsQuery = (grupoId: string) =>
  queryOptions({
    queryKey: ["cards", grupoId],
    queryFn: async () =>
      check(await supabase.from("cards").select("*").eq("grupo_id", grupoId).order("orden")),
  });

export const actividadQuery = (grupoId: string) =>
  queryOptions({
    queryKey: ["actividad", grupoId],
    queryFn: async () =>
      check(
        await supabase
          .from("actividad")
          .select("*")
          .eq("grupo_id", grupoId)
          .order("created_at", { ascending: false })
          .limit(500),
      ),
  });

export const adjuntosQuery = (cardId: string) =>
  queryOptions({
    queryKey: ["adjuntos", cardId],
    queryFn: async () =>
      check(
        await supabase
          .from("card_adjuntos")
          .select("*")
          .eq("card_id", cardId)
          .order("created_at", { ascending: false }),
      ),
  });

export const ACCION_TEXTO: Record<string, string> = {
  crear: "creó la tarea",
  mover: "movió",
  editar: "editó",
  eliminar: "eliminó la tarea",
  puntuar: "puntuó",
  adjuntar: "adjuntó",
  sumar_integrante: "sumó a",
  quitar_integrante: "quitó a",
};

export function formatoTamano(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
