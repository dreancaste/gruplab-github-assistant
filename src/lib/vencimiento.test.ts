import { describe, expect, it } from "vitest";
import { estadoVencimiento } from "./vencimiento";

const ahora = new Date(2026, 4, 10, 12, 0, 0); // 10/05/2026 12:00 local

describe("estadoVencimiento", () => {
  it("una fecha pasada es vencida", () => {
    expect(estadoVencimiento("2026-05-09", "progreso", ahora)).toBe("vencida");
  });
  it("vence hoy o en los próximos 2 días: vence pronto", () => {
    expect(estadoVencimiento("2026-05-10", "backlog", ahora)).toBe("pronto");
    expect(estadoVencimiento("2026-05-11", "backlog", ahora)).toBe("pronto");
  });
  it("con más de 2 días de margen no avisa", () => {
    expect(estadoVencimiento("2026-05-14", "backlog", ahora)).toBeNull();
  });
  it("las tareas hechas nunca se marcan", () => {
    expect(estadoVencimiento("2026-05-01", "hecho", ahora)).toBeNull();
  });
  it("sin fecha límite no avisa", () => {
    expect(estadoVencimiento(null, "progreso", ahora)).toBeNull();
  });
});
