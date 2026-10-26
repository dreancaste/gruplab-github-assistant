// Alertas de vencimiento de tareas. "Vence pronto" = faltan 2 días o menos.
export const DIAS_AVISO_VENCIMIENTO = 2;

export type EstadoVencimiento = "vencida" | "pronto" | null;

export function hoyLocal(ahora = new Date()): string {
  return [
    ahora.getFullYear(),
    String(ahora.getMonth() + 1).padStart(2, "0"),
    String(ahora.getDate()).padStart(2, "0"),
  ].join("-");
}

export function estadoVencimiento(
  fechaLimite: string | null | undefined,
  estado: string,
  ahora = new Date(),
): EstadoVencimiento {
  if (!fechaLimite || estado === "hecho") return null;
  const hoy = hoyLocal(ahora);
  if (fechaLimite < hoy) return "vencida";
  const limite = new Date(`${fechaLimite}T23:59:59`);
  const dias = (limite.getTime() - ahora.getTime()) / 86_400_000;
  return dias >= 0 && dias <= DIAS_AVISO_VENCIMIENTO ? "pronto" : null;
}
