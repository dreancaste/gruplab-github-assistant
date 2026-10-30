// Reglas del flujo de tareas (espejo de la base; la base es quien decide).
// Sirven para mostrar mensajes claros antes de intentar el cambio.

export type TarjetaRegla = {
  estado: string;
  asignados: string[];
  revisada_por: string | null;
};

export type ContextoTablero = {
  /** Tablero independiente (sin aula). */
  esIndependiente: boolean;
  /** Integrantes del grupo (los docentes no son integrantes). */
  integrantes: string[];
  uid: string;
  esStaff: boolean;
};

/** Tablero independiente o grupo de una sola persona: no hace falta revisión para completar. */
export function esTableroIndividual(ctx: Pick<ContextoTablero, "esIndependiente" | "integrantes">): boolean {
  return ctx.esIndependiente || ctx.integrantes.length <= 1;
}

/** Todo el grupo está asignado a la tarea. */
export function todoElGrupoAsignado(card: TarjetaRegla, integrantes: string[]): boolean {
  return integrantes.length > 0 && integrantes.every((id) => card.asignados.includes(id));
}

/** ¿Puede esta persona marcar la tarea como revisada? */
export function puedeRevisar(card: TarjetaRegla, ctx: ContextoTablero): boolean {
  if (card.estado !== "revision" || card.revisada_por === ctx.uid) return false;
  if (ctx.esIndependiente && ctx.integrantes.length <= 1) return false;
  if (ctx.esStaff) return true;
  if (!ctx.integrantes.includes(ctx.uid)) return false;
  return !card.asignados.includes(ctx.uid) || todoElGrupoAsignado(card, ctx.integrantes);
}

/** La revisión que ya tiene la tarea sirve para pasarla a Hecho. */
export function tieneRevisionValida(card: TarjetaRegla, ctx: ContextoTablero): boolean {
  const r = card.revisada_por;
  if (!r) return false;
  return todoElGrupoAsignado(card, ctx.integrantes) || !card.asignados.includes(r);
}

/** Si al pasar a Hecho, quien la mueve cuenta como revisor. */
export function seAutoRevisa(card: TarjetaRegla, ctx: ContextoTablero): boolean {
  if (esTableroIndividual(ctx) || tieneRevisionValida(card, ctx)) return false;
  if (ctx.esStaff) return true;
  return (
    ctx.integrantes.includes(ctx.uid) &&
    (!card.asignados.includes(ctx.uid) || todoElGrupoAsignado(card, ctx.integrantes))
  );
}

/** Devuelve un mensaje si la tarea todavía no puede pasar a Hecho. */
export function motivoNoCompletar(card: TarjetaRegla, ctx: ContextoTablero): string | null {
  if (esTableroIndividual(ctx)) return null;
  if (card.asignados.length === 0) return "Asigná al menos una persona antes de completar la tarea.";
  if (tieneRevisionValida(card, ctx) || seAutoRevisa(card, ctx)) return null;
  return "Antes de completar, otra persona del grupo (no asignada) tiene que revisar esta tarea.";
}
