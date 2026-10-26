// Cálculo objetivo de participación de cada integrante.
// Combina cuatro factores, cada uno expresado como "porcentaje del aporte del grupo":
//   - Esfuerzo (50%): esfuerzo de las tareas terminadas, repartido entre sus asignados.
//   - Puntualidad (20%): qué parte de su esfuerzo con fecha límite entregó a tiempo.
//   - Calidad / colaboración (15%): tareas sin retrabajo + revisiones hechas a compañeros.
//   - Evaluación de pares (15%): promedio que le pusieron sus compañeros (1 a 5).
// Si un factor todavía no tiene datos, su peso se reparte entre los demás.

export const PESOS_PARTICIPACION = {
  esfuerzo: 50,
  puntualidad: 20,
  calidadColaboracion: 15,
  pares: 15,
} as const;

export const PESOS_ESFUERZO = [1, 3, 5] as const;

export type CardMetrica = {
  id: string;
  estado: string;
  peso_esfuerzo: number | null;
  asignados: string[] | null;
  fecha_limite: string | null;
  completada_en: string | null;
};

export type ActividadMinima = { user_id: string | null; accion: string; entidad_id: string | null };

export type ParesResumen = { evaluado_id: string; promedio: number; cantidad: number };

export type Participacion = {
  userId: string;
  esfuerzo: number | null;
  puntualidad: number | null;
  calidad: number | null;
  colaboracion: number | null;
  pares: number | null;
  /** Porcentaje final ponderado (0–100). null si todavía no hay ningún dato. */
  participacion: number | null;
  evaluacionesRecibidas: number;
  /** Aporta menos de la mitad de una parte equitativa. */
  baja: boolean;
};

export type FormulaVigente = {
  esfuerzo: number;
  puntualidad: number;
  calidadColaboracion: number;
  pares: number;
};

/** Fecha local (YYYY-MM-DD) de un timestamp ISO. */
function fechaLocal(iso: string): string {
  const d = new Date(iso);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function normalizar(valores: Map<string, number>, disponible: boolean): Map<string, number> | null {
  if (!disponible) return null;
  const total = [...valores.values()].reduce((s, v) => s + v, 0);
  if (!total) {
    const n = valores.size;
    return n ? new Map([...valores.keys()].map((id) => [id, 100 / n])) : null;
  }
  return new Map([...valores].map(([id, v]) => [id, (v / total) * 100]));
}

function combinar(...metricas: (Map<string, number> | null)[]): Map<string, number> | null {
  const disp = metricas.filter((m): m is Map<string, number> => m !== null);
  if (!disp.length) return null;
  const ids = new Set(disp.flatMap((m) => [...m.keys()]));
  return new Map([...ids].map((id) => [id, disp.reduce((s, m) => s + (m.get(id) ?? 0), 0) / disp.length]));
}

export function calcularParticipacion(
  integrantes: string[],
  cards: CardMetrica[],
  actividad: ActividadMinima[],
  pares: ParesResumen[] = [],
): Participacion[] {
  const miembros = [...new Set(integrantes.filter(Boolean))];
  const esMiembro = new Set(miembros);
  const cero = () => new Map(miembros.map((id) => [id, 0]));

  const eventosPorCard = new Map<string, ActividadMinima[]>();
  for (const a of actividad) {
    if (!a.entidad_id || (a.accion !== "revisar" && a.accion !== "reabrir")) continue;
    const l = eventosPorCard.get(a.entidad_id) ?? [];
    l.push(a);
    eventosPorCard.set(a.entidad_id, l);
  }

  const entregado = cero();
  const aTiempo = cero();
  const conFecha = cero();
  const sinRetrabajo = cero();
  const revisiones = new Map(miembros.map((id) => [id, new Set<string>()]));
  let entregadoTotal = 0;
  let conFechaTotal = 0;
  let calidadAplicable = false;

  for (const card of cards) {
    const completada = card.estado === "hecho" && card.completada_en != null;
    if (!completada) continue;
    const eventos = eventosPorCard.get(card.id) ?? [];
    const asignados = [...new Set(card.asignados ?? [])].filter((id) => esMiembro.has(id));

    for (const e of eventos) {
      if (e.accion === "revisar" && e.user_id && esMiembro.has(e.user_id) && !asignados.includes(e.user_id)) {
        revisiones.get(e.user_id)?.add(card.id);
      }
    }
    if (!asignados.length) continue;

    const peso = (PESOS_ESFUERZO as readonly number[]).includes(card.peso_esfuerzo ?? 1) ? (card.peso_esfuerzo ?? 1) : 1;
    const porIntegrante = peso / asignados.length;
    const retrabajo = eventos.some((e) => e.accion === "reabrir");
    calidadAplicable = true;

    for (const id of asignados) {
      entregado.set(id, entregado.get(id)! + porIntegrante);
      entregadoTotal += porIntegrante;
      if (!retrabajo) sinRetrabajo.set(id, sinRetrabajo.get(id)! + porIntegrante);
      if (card.fecha_limite) {
        conFecha.set(id, conFecha.get(id)! + porIntegrante);
        conFechaTotal += porIntegrante;
        if (fechaLocal(card.completada_en!) <= card.fecha_limite) aTiempo.set(id, aTiempo.get(id)! + porIntegrante);
      }
    }
  }

  const ratio = (num: Map<string, number>, den: Map<string, number>) =>
    new Map(miembros.map((id) => [id, den.get(id)! ? num.get(id)! / den.get(id)! : 0]));

  const colabConteo = new Map(miembros.map((id) => [id, revisiones.get(id)!.size]));

  const paresPorId = new Map(pares.filter((p) => esMiembro.has(p.evaluado_id)).map((p) => [p.evaluado_id, p]));
  const paresCompletos = miembros.length > 1 && miembros.every((id) => (paresPorId.get(id)?.cantidad ?? 0) > 0);

  const esfuerzo = normalizar(entregado, entregadoTotal > 0);
  const puntualidad = normalizar(ratio(aTiempo, conFecha), conFechaTotal > 0);
  const calidad = normalizar(ratio(sinRetrabajo, entregado), calidadAplicable);
  const colaboracion = normalizar(colabConteo, [...colabConteo.values()].some((n) => n > 0));
  const paresM = normalizar(
    new Map(miembros.map((id) => [id, paresCompletos ? Number(paresPorId.get(id)!.promedio) : 0])),
    paresCompletos,
  );
  const calidadColab = combinar(calidad, colaboracion);

  const factores = [esfuerzo, puntualidad, calidadColab, paresM];
  const pesos = [
    PESOS_PARTICIPACION.esfuerzo,
    PESOS_PARTICIPACION.puntualidad,
    PESOS_PARTICIPACION.calidadColaboracion,
    PESOS_PARTICIPACION.pares,
  ];
  const pesoTotal = factores.reduce((s, f, i) => s + (f ? pesos[i] : 0), 0);
  const umbral = miembros.length ? 100 / miembros.length / 2 : 0;

  return miembros
    .map((userId) => {
      const participacion = pesoTotal
        ? factores.reduce((s, f, i) => s + ((f?.get(userId) ?? 0) * pesos[i]) / pesoTotal, 0)
        : null;
      return {
        userId,
        esfuerzo: esfuerzo?.get(userId) ?? null,
        puntualidad: puntualidad?.get(userId) ?? null,
        calidad: calidad?.get(userId) ?? null,
        colaboracion: colaboracion?.get(userId) ?? null,
        pares: paresM?.get(userId) ?? null,
        participacion,
        evaluacionesRecibidas: paresPorId.get(userId)?.cantidad ?? 0,
        baja: participacion != null && participacion < umbral,
      };
    })
    .sort((a, b) => (b.participacion ?? 0) - (a.participacion ?? 0));
}

/** Pesos efectivos (en %) según qué factores tienen datos. */
export function formulaVigente(filas: Participacion[]): FormulaVigente | null {
  const hay = (k: keyof Participacion) => filas.some((f) => f[k] !== null);
  const f = [
    hay("esfuerzo") ? PESOS_PARTICIPACION.esfuerzo : 0,
    hay("puntualidad") ? PESOS_PARTICIPACION.puntualidad : 0,
    hay("calidad") || hay("colaboracion") ? PESOS_PARTICIPACION.calidadColaboracion : 0,
    hay("pares") ? PESOS_PARTICIPACION.pares : 0,
  ];
  const suma = f.reduce((s, n) => s + n, 0);
  if (!suma) return null;
  return {
    esfuerzo: (f[0] / suma) * 100,
    puntualidad: (f[1] / suma) * 100,
    calidadColaboracion: (f[2] / suma) * 100,
    pares: (f[3] / suma) * 100,
  };
}
