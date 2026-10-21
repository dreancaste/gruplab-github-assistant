// Cálculo objetivo de participación a partir del registro de actividad.
// Solo cuentan las acciones de trabajo hechas por integrantes del grupo.

export const ACCIONES_DE_TRABAJO = ["crear", "mover", "editar", "adjuntar", "eliminar"] as const;

export type ActividadMinima = { user_id: string | null; accion: string };

export type Participacion = {
  userId: string;
  acciones: number;
  porcentaje: number;
  baja: boolean;
};

/**
 * Devuelve el % de aporte de cada integrante.
 * Se marca "baja" a quien aporta menos de la mitad de una parte equitativa
 * (por ejemplo, con 4 integrantes: menos de 12,5%).
 */
export function calcularParticipacion(
  actividad: ActividadMinima[],
  integrantes: string[],
): Participacion[] {
  const conteo = new Map<string, number>(integrantes.map((id) => [id, 0]));
  for (const a of actividad) {
    if (!a.user_id || !conteo.has(a.user_id)) continue;
    if (!(ACCIONES_DE_TRABAJO as readonly string[]).includes(a.accion)) continue;
    conteo.set(a.user_id, (conteo.get(a.user_id) ?? 0) + 1);
  }
  const total = Array.from(conteo.values()).reduce((s, n) => s + n, 0);
  const umbral = integrantes.length > 0 ? 100 / integrantes.length / 2 : 0;

  return integrantes
    .map((userId) => {
      const acciones = conteo.get(userId) ?? 0;
      const porcentaje = total === 0 ? 0 : Math.round((acciones / total) * 1000) / 10;
      return { userId, acciones, porcentaje, baja: total > 0 && porcentaje < umbral };
    })
    .sort((a, b) => b.acciones - a.acciones);
}
