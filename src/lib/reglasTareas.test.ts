import { describe, expect, it } from "vitest";
import { motivoNoCompletar, puedeRevisar, seAutoRevisa, type ContextoTablero } from "./reglasTareas";

const card = (estado: string, asignados: string[], revisada_por: string | null = null) => ({
  estado,
  asignados,
  revisada_por,
});
const equipo = (uid: string, extra: Partial<ContextoTablero> = {}): ContextoTablero => ({
  esIndependiente: false,
  integrantes: ["a", "b", "c"],
  uid,
  esStaff: false,
  ...extra,
});

describe("completar tareas", () => {
  it("en un tablero individual se completa sin responsables ni revisión", () => {
    const ctx: ContextoTablero = { esIndependiente: true, integrantes: ["a"], uid: "a", esStaff: false };
    expect(motivoNoCompletar(card("progreso", []), ctx)).toBeNull();
  });

  it("en un grupo del aula con una sola persona tampoco hace falta revisión", () => {
    expect(motivoNoCompletar(card("progreso", []), equipo("a", { integrantes: ["a"] }))).toBeNull();
  });

  it("en un grupo de varios, sin responsables no se puede completar", () => {
    expect(motivoNoCompletar(card("progreso", []), equipo("a"))).toBe(
      "Asigná al menos una persona antes de completar la tarea.",
    );
  });

  it("el único asignado no puede completar su tarea sin revisión", () => {
    expect(motivoNoCompletar(card("progreso", ["a"]), equipo("a"))).not.toBeNull();
  });

  it("otro integrante que no está asignado la completa y cuenta como revisión", () => {
    const c = card("progreso", ["a"]);
    expect(motivoNoCompletar(c, equipo("b"))).toBeNull();
    expect(seAutoRevisa(c, equipo("b"))).toBe(true);
  });

  it("el docente puede completar y cuenta como revisión", () => {
    expect(seAutoRevisa(card("progreso", ["a"]), equipo("doc", { esStaff: true }))).toBe(true);
  });

  it("con una revisión válida el asignado ya puede completarla", () => {
    expect(motivoNoCompletar(card("revision", ["a"], "b"), equipo("a"))).toBeNull();
  });
});

describe("revisar tareas", () => {
  it("si todo el grupo está asignado, un asignado puede revisar", () => {
    expect(puedeRevisar(card("revision", ["a", "b", "c"]), equipo("a"))).toBe(true);
  });

  it("si no está todo el grupo asignado, un asignado no puede revisar", () => {
    expect(puedeRevisar(card("revision", ["a", "b"]), equipo("a"))).toBe(false);
  });

  it("el docente puede revisar", () => {
    expect(puedeRevisar(card("revision", ["a"]), equipo("doc", { esStaff: true }))).toBe(true);
  });

  it("solo se revisa una tarea que está en Revisión", () => {
    expect(puedeRevisar(card("progreso", ["a"]), equipo("b"))).toBe(false);
  });
});
