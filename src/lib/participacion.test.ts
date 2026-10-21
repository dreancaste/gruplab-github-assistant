import { describe, expect, it } from "vitest";
import { calcularParticipacion } from "./participacion";

describe("calcularParticipacion", () => {
  it("reparte el porcentaje según las acciones de cada integrante", () => {
    const res = calcularParticipacion(
      [
        { user_id: "a", accion: "crear" },
        { user_id: "a", accion: "mover" },
        { user_id: "a", accion: "editar" },
        { user_id: "b", accion: "adjuntar" },
      ],
      ["a", "b"],
    );
    expect(res.find((p) => p.userId === "a")?.porcentaje).toBe(75);
    expect(res.find((p) => p.userId === "b")?.porcentaje).toBe(25);
  });

  it("no cuenta las puntuaciones del docente ni a quien no es integrante", () => {
    const res = calcularParticipacion(
      [
        { user_id: "a", accion: "crear" },
        { user_id: "docente", accion: "puntuar" },
        { user_id: "docente", accion: "mover" },
        { user_id: "a", accion: "puntuar" },
      ],
      ["a", "b"],
    );
    expect(res.find((p) => p.userId === "a")?.acciones).toBe(1);
    expect(res.find((p) => p.userId === "a")?.porcentaje).toBe(100);
    expect(res.find((p) => p.userId === "docente")).toBeUndefined();
  });

  it("marca baja participación debajo de la mitad de una parte equitativa", () => {
    const actividad = [
      ...Array(6).fill({ user_id: "a", accion: "mover" }),
      ...Array(3).fill({ user_id: "b", accion: "mover" }),
      { user_id: "c", accion: "mover" },
    ];
    const res = calcularParticipacion(actividad, ["a", "b", "c"]);
    expect(res.find((p) => p.userId === "c")?.baja).toBe(true);
    expect(res.find((p) => p.userId === "b")?.baja).toBe(false);
  });

  it("sin actividad todos tienen 0% y nadie queda marcado", () => {
    const res = calcularParticipacion([], ["a", "b"]);
    expect(res.every((p) => p.porcentaje === 0 && !p.baja)).toBe(true);
  });
});
