import { describe, expect, it } from "vitest";
import { calcularParticipacion, formulaVigente, type CardMetrica } from "./participacion";

const hecha = (id: string, asignados: string[], extra: Partial<CardMetrica> = {}): CardMetrica => ({
  id,
  estado: "hecho",
  peso_esfuerzo: 1,
  asignados,
  fecha_limite: null,
  completada_en: "2026-05-10T12:00:00Z",
  ...extra,
});

const de = (res: ReturnType<typeof calcularParticipacion>, id: string) => res.find((p) => p.userId === id)!;

describe("calcularParticipacion", () => {
  it("el esfuerzo se reparte según el peso de las tareas terminadas", () => {
    const res = calcularParticipacion(
      ["a", "b"],
      [hecha("1", ["a"], { peso_esfuerzo: 3 }), hecha("2", ["b"], { peso_esfuerzo: 1 })],
      [],
    );
    expect(de(res, "a").esfuerzo).toBeCloseTo(75);
    expect(de(res, "b").esfuerzo).toBeCloseTo(25);
  });

  it("una tarea con dos asignados reparte su esfuerzo en partes iguales", () => {
    const res = calcularParticipacion(["a", "b"], [hecha("1", ["a", "b"], { peso_esfuerzo: 5 })], []);
    expect(de(res, "a").esfuerzo).toBeCloseTo(50);
    expect(de(res, "b").esfuerzo).toBeCloseTo(50);
  });

  it("las tareas que no están en Hecho no suman", () => {
    const res = calcularParticipacion(
      ["a", "b"],
      [hecha("1", ["a"]), { ...hecha("2", ["b"]), estado: "revision", completada_en: null }],
      [],
    );
    expect(de(res, "a").esfuerzo).toBeCloseTo(100);
    expect(de(res, "b").esfuerzo).toBeCloseTo(0);
  });

  it("con solo esfuerzo disponible, la participación es igual al esfuerzo", () => {
    const res = calcularParticipacion(["a", "b"], [hecha("1", ["a"], { peso_esfuerzo: 3 }), hecha("2", ["b"])], []);
    expect(de(res, "a").participacion).toBeCloseTo(75);
    expect(formulaVigente(res)).toMatchObject({ esfuerzo: 100, puntualidad: 0, pares: 0 });
  });

  it("pondera esfuerzo 50, puntualidad 20, calidad/colaboración 15 y pares 15", () => {
    const res = calcularParticipacion(
      ["a", "b"],
      [
        // a entrega a tiempo, b tarde
        hecha("1", ["a"], { fecha_limite: "2026-05-10" }),
        hecha("2", ["b"], { fecha_limite: "2026-05-01" }),
      ],
      [],
      [
        { evaluado_id: "a", promedio: 4, cantidad: 1 },
        { evaluado_id: "b", promedio: 4, cantidad: 1 },
      ],
    );
    // esfuerzo 50/50, puntualidad 100/0, calidad 50/50 (sin colaboración), pares 50/50
    expect(de(res, "a").puntualidad).toBeCloseTo(100);
    expect(de(res, "a").participacion).toBeCloseTo(50 * 0.5 + 100 * 0.2 + 50 * 0.15 + 50 * 0.15);
    expect(de(res, "b").participacion).toBeCloseTo(50 * 0.5 + 0 * 0.2 + 50 * 0.15 + 50 * 0.15);
  });

  it("una tarea reabierta resta en calidad a sus asignados", () => {
    const res = calcularParticipacion(
      ["a", "b"],
      [hecha("1", ["a"]), hecha("2", ["b"])],
      [{ user_id: "b", accion: "reabrir", entidad_id: "2" }],
    );
    expect(de(res, "a").calidad).toBeCloseTo(100);
    expect(de(res, "b").calidad).toBeCloseTo(0);
  });

  it("revisar tareas de otros suma colaboración; revisar las propias no", () => {
    const res = calcularParticipacion(
      ["a", "b"],
      [hecha("1", ["a"]), hecha("2", ["b"])],
      [
        { user_id: "b", accion: "revisar", entidad_id: "1" },
        { user_id: "b", accion: "revisar", entidad_id: "2" },
      ],
    );
    expect(de(res, "b").colaboracion).toBeCloseTo(100);
    expect(de(res, "a").colaboracion).toBeCloseTo(0);
  });

  it("la evaluación de pares solo cuenta cuando todos los integrantes fueron evaluados", () => {
    const res = calcularParticipacion(["a", "b"], [hecha("1", ["a"])], [], [{ evaluado_id: "a", promedio: 5, cantidad: 2 }]);
    expect(de(res, "a").pares).toBeNull();
    expect(de(res, "a").evaluacionesRecibidas).toBe(2);
  });

  it("ignora a quien no es integrante (por ejemplo, el docente)", () => {
    const res = calcularParticipacion(["a", "b"], [hecha("1", ["a", "docente"])], [
      { user_id: "docente", accion: "revisar", entidad_id: "1" },
    ]);
    expect(res.find((p) => p.userId === "docente")).toBeUndefined();
    expect(de(res, "a").esfuerzo).toBeCloseTo(100);
    expect(de(res, "a").colaboracion).toBeNull();
  });

  it("marca baja participación debajo de la mitad de una parte equitativa", () => {
    const res = calcularParticipacion(
      ["a", "b", "c"],
      [hecha("1", ["a"], { peso_esfuerzo: 5 }), hecha("2", ["b"], { peso_esfuerzo: 3 }), hecha("3", ["c"])],
      [],
    );
    // c: 1/9 = 11,1% < 16,7%
    expect(de(res, "c").baja).toBe(true);
    expect(de(res, "b").baja).toBe(false);
  });

  it("sin tareas terminadas no hay porcentaje y nadie queda marcado", () => {
    const res = calcularParticipacion(["a", "b"], [], []);
    expect(res.every((p) => p.participacion === null && !p.baja)).toBe(true);
    expect(formulaVigente(res)).toBeNull();
  });
});
