-- ===== Tareas: planificación, revisión y cierre =====
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS fecha_limite date,
  ADD COLUMN IF NOT EXISTS peso_esfuerzo smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS asignados uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS revisada_por uuid,
  ADD COLUMN IF NOT EXISTS revisada_en timestamptz,
  ADD COLUMN IF NOT EXISTS completada_en timestamptz;

ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_peso_esfuerzo_check;
ALTER TABLE public.cards ADD CONSTRAINT cards_peso_esfuerzo_check CHECK (peso_esfuerzo IN (1, 3, 5));

UPDATE public.cards SET completada_en = updated_at WHERE estado = 'hecho' AND completada_en IS NULL;

CREATE OR REPLACE FUNCTION public.cards_reglas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _staff boolean;
  _a uuid;
BEGIN
  _staff := _uid IS NULL OR public.es_staff_grupo(NEW.grupo_id, _uid);
  NEW.asignados := coalesce(ARRAY(SELECT DISTINCT x FROM unnest(NEW.asignados) x WHERE x IS NOT NULL), '{}');
  FOREACH _a IN ARRAY NEW.asignados LOOP
    IF NOT public.es_miembro_grupo(NEW.grupo_id, _a) THEN
      RAISE EXCEPTION 'Solo podés asignar integrantes del grupo';
    END IF;
  END LOOP;

  IF TG_OP = 'INSERT' THEN
    NEW.creado_por := _uid;
    IF NOT _staff THEN
      NEW.puntuacion := NULL;
      NEW.comentario_profesor := NULL;
    END IF;
    IF NEW.estado = 'hecho' THEN
      RAISE EXCEPTION 'Una tarea nueva no puede crearse como hecha';
    END IF;
    NEW.revisada_por := NULL;
    NEW.revisada_en := NULL;
    NEW.completada_en := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF (NEW.puntuacion IS DISTINCT FROM OLD.puntuacion OR NEW.comentario_profesor IS DISTINCT FROM OLD.comentario_profesor)
     AND NOT _staff THEN
    RAISE EXCEPTION 'Solo el docente puede puntuar o comentar';
  END IF;
  NEW.grupo_id := OLD.grupo_id;
  NEW.creado_por := OLD.creado_por;
  NEW.updated_at := now();

  -- El esfuerzo y la asignación se congelan cuando la tarea ya arrancó
  IF NOT _staff AND OLD.estado <> 'backlog' AND cardinality(OLD.asignados) > 0
     AND (NEW.asignados IS DISTINCT FROM OLD.asignados OR NEW.peso_esfuerzo IS DISTINCT FROM OLD.peso_esfuerzo) THEN
    RAISE EXCEPTION 'El esfuerzo y la asignación se congelan al iniciar la tarea';
  END IF;

  -- Las marcas de tiempo las maneja la base, no el navegador
  NEW.completada_en := OLD.completada_en;
  NEW.revisada_en := OLD.revisada_en;

  -- Revisión: la hace un integrante que no esté asignado, con la tarea en Revisión
  IF NEW.revisada_por IS DISTINCT FROM OLD.revisada_por THEN
    IF NEW.revisada_por IS NOT NULL THEN
      IF _uid IS NOT NULL AND NEW.revisada_por <> _uid THEN
        RAISE EXCEPTION 'Solo podés registrar tu propia revisión';
      END IF;
      IF OLD.estado <> 'revision' OR NEW.estado <> 'revision' THEN
        RAISE EXCEPTION 'Solo se pueden revisar tareas que están en Revisión';
      END IF;
      IF NOT public.es_miembro_grupo(NEW.grupo_id, NEW.revisada_por) THEN
        RAISE EXCEPTION 'Solo los integrantes del grupo pueden revisar tareas';
      END IF;
      IF NEW.revisada_por = ANY (NEW.asignados) THEN
        RAISE EXCEPTION 'La revisión debe hacerla alguien que no esté asignado a la tarea';
      END IF;
      NEW.revisada_en := now();
    ELSE
      NEW.revisada_en := NULL;
    END IF;
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    IF NEW.estado = 'hecho' THEN
      IF cardinality(NEW.asignados) = 0 THEN
        RAISE EXCEPTION 'Asigná al menos una persona antes de completar la tarea';
      END IF;
      IF NEW.revisada_por IS NULL OR NEW.revisada_por = ANY (NEW.asignados) THEN
        RAISE EXCEPTION 'Antes de completar, otra persona del grupo tiene que revisar la tarea';
      END IF;
      NEW.completada_en := now();
    ELSE
      IF OLD.estado = 'hecho' THEN
        NEW.completada_en := NULL;
      END IF;
      -- Al salir de Revisión (o entrar de nuevo) la revisión anterior deja de valer
      NEW.revisada_por := NULL;
      NEW.revisada_en := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_cards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.actividad (grupo_id, user_id, accion, entidad, entidad_id, detalle)
    VALUES (NEW.grupo_id, auth.uid(), 'crear', 'card', NEW.id, NEW.titulo);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.grupos WHERE id = OLD.grupo_id) THEN
      INSERT INTO public.actividad (grupo_id, user_id, accion, entidad, entidad_id, detalle)
      VALUES (OLD.grupo_id, auth.uid(), 'eliminar', 'card', OLD.id, OLD.titulo);
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.estado IS DISTINCT FROM OLD.estado THEN
      INSERT INTO public.actividad (grupo_id, user_id, accion, entidad, entidad_id, detalle)
      VALUES (NEW.grupo_id, auth.uid(), 'mover', 'card', NEW.id,
              NEW.titulo || ' · ' || public.estado_label(OLD.estado) || ' → ' || public.estado_label(NEW.estado));
      IF OLD.estado = 'hecho' THEN
        INSERT INTO public.actividad (grupo_id, user_id, accion, entidad, entidad_id, detalle)
        VALUES (NEW.grupo_id, auth.uid(), 'reabrir', 'card', NEW.id, NEW.titulo);
      END IF;
    END IF;
    IF NEW.revisada_por IS NOT NULL AND NEW.revisada_por IS DISTINCT FROM OLD.revisada_por THEN
      INSERT INTO public.actividad (grupo_id, user_id, accion, entidad, entidad_id, detalle)
      VALUES (NEW.grupo_id, NEW.revisada_por, 'revisar', 'card', NEW.id, NEW.titulo);
    END IF;
    IF NEW.puntuacion IS DISTINCT FROM OLD.puntuacion OR NEW.comentario_profesor IS DISTINCT FROM OLD.comentario_profesor THEN
      INSERT INTO public.actividad (grupo_id, user_id, accion, entidad, entidad_id, detalle)
      VALUES (NEW.grupo_id, auth.uid(), 'puntuar', 'card', NEW.id,
              NEW.titulo || coalesce(' · ' || NEW.puntuacion::text || '/10', ''));
    END IF;
    IF NEW.titulo IS DISTINCT FROM OLD.titulo OR NEW.descripcion IS DISTINCT FROM OLD.descripcion
       OR NEW.fecha_limite IS DISTINCT FROM OLD.fecha_limite OR NEW.peso_esfuerzo IS DISTINCT FROM OLD.peso_esfuerzo
       OR NEW.asignados IS DISTINCT FROM OLD.asignados THEN
      INSERT INTO public.actividad (grupo_id, user_id, accion, entidad, entidad_id, detalle)
      VALUES (NEW.grupo_id, auth.uid(), 'editar', 'card', NEW.id, NEW.titulo);
    END IF;
    RETURN NEW;
  END IF;
END;
$function$;

-- ===== Evaluación entre pares =====
CREATE TABLE public.evaluaciones_pares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  evaluador_id uuid NOT NULL,
  evaluado_id uuid NOT NULL,
  coordinacion smallint NOT NULL CHECK (coordinacion BETWEEN 1 AND 5),
  comunicacion smallint NOT NULL CHECK (comunicacion BETWEEN 1 AND 5),
  responsabilidad smallint NOT NULL CHECK (responsabilidad BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, evaluador_id, evaluado_id)
);
CREATE INDEX evaluaciones_pares_grupo_idx ON public.evaluaciones_pares (grupo_id);

GRANT SELECT ON public.evaluaciones_pares TO authenticated;
GRANT ALL ON public.evaluaciones_pares TO service_role;
ALTER TABLE public.evaluaciones_pares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver mis evaluaciones o como docente" ON public.evaluaciones_pares
  FOR SELECT TO authenticated
  USING (evaluador_id = auth.uid() OR public.es_staff_grupo(grupo_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.evaluar_par(
  _card_id uuid, _evaluado_id uuid, _coordinacion int, _comunicacion int, _responsabilidad int
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _c public.cards;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Necesitás iniciar sesión'; END IF;
  SELECT * INTO _c FROM public.cards WHERE id = _card_id;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'Tarea no encontrada'; END IF;
  IF _c.estado <> 'hecho' THEN RAISE EXCEPTION 'Solo se evalúa al equipo en tareas terminadas'; END IF;
  IF NOT public.es_miembro_grupo(_c.grupo_id, _uid) THEN RAISE EXCEPTION 'Solo los integrantes del grupo pueden evaluar'; END IF;
  IF NOT public.es_miembro_grupo(_c.grupo_id, _evaluado_id) THEN RAISE EXCEPTION 'Esa persona no es del grupo'; END IF;
  IF _evaluado_id = _uid THEN RAISE EXCEPTION 'No podés evaluarte a vos mismo'; END IF;
  IF least(_coordinacion, _comunicacion, _responsabilidad) < 1 OR greatest(_coordinacion, _comunicacion, _responsabilidad) > 5 THEN
    RAISE EXCEPTION 'Cada respuesta tiene que ser un número entre 1 y 5';
  END IF;
  IF EXISTS (SELECT 1 FROM public.evaluaciones_pares WHERE card_id = _card_id AND evaluador_id = _uid AND evaluado_id = _evaluado_id) THEN
    RAISE EXCEPTION 'Ya evaluaste a esta persona en esta tarea';
  END IF;
  INSERT INTO public.evaluaciones_pares (grupo_id, card_id, evaluador_id, evaluado_id, coordinacion, comunicacion, responsabilidad)
  VALUES (_c.grupo_id, _card_id, _uid, _evaluado_id, _coordinacion, _comunicacion, _responsabilidad);
END;
$function$;

-- Resumen anónimo: promedio recibido por integrante (sin revelar quién evaluó a quién)
CREATE OR REPLACE FUNCTION public.resumen_pares(_grupo_ids uuid[])
RETURNS TABLE (grupo_id uuid, evaluado_id uuid, promedio numeric, cantidad int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT e.grupo_id, e.evaluado_id,
         avg((e.coordinacion + e.comunicacion + e.responsabilidad) / 3.0) AS promedio,
         count(*)::int AS cantidad
  FROM public.evaluaciones_pares e
  JOIN public.cards c ON c.id = e.card_id AND c.estado = 'hecho' AND c.completada_en IS NOT NULL
  WHERE e.grupo_id = ANY (_grupo_ids)
    AND public.puede_ver_grupo(e.grupo_id, auth.uid())
    AND e.evaluador_id <> e.evaluado_id
    AND public.es_miembro_grupo(e.grupo_id, e.evaluador_id)
    AND public.es_miembro_grupo(e.grupo_id, e.evaluado_id)
  GROUP BY e.grupo_id, e.evaluado_id
$function$;

-- ===== Solicitudes de ingreso a grupos =====
CREATE TABLE public.solicitudes_grupo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  aula_id uuid NOT NULL REFERENCES public.aulas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptada', 'rechazada')),
  resuelta_por uuid,
  resuelta_en timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX solicitudes_grupo_pendiente_uq ON public.solicitudes_grupo (grupo_id, user_id) WHERE estado = 'pendiente';
CREATE INDEX solicitudes_grupo_aula_idx ON public.solicitudes_grupo (aula_id);

GRANT SELECT, DELETE ON public.solicitudes_grupo TO authenticated;
GRANT ALL ON public.solicitudes_grupo TO service_role;
ALTER TABLE public.solicitudes_grupo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver mis solicitudes o las que gestiono" ON public.solicitudes_grupo
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.puede_gestionar_grupo(grupo_id, auth.uid()));

CREATE POLICY "cancelar mi solicitud pendiente" ON public.solicitudes_grupo
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND estado = 'pendiente');

CREATE OR REPLACE FUNCTION public.solicitar_ingreso(_grupo_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _g public.grupos; _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Necesitás iniciar sesión'; END IF;
  SELECT * INTO _g FROM public.grupos WHERE id = _grupo_id;
  IF _g.id IS NULL OR _g.aula_id IS NULL THEN RAISE EXCEPTION 'Grupo no encontrado'; END IF;
  IF public.rol_en_aula(_g.aula_id, _uid) IS DISTINCT FROM 'alumno' THEN
    RAISE EXCEPTION 'Solo los alumnos del aula pueden pedir unirse a un grupo';
  END IF;
  IF EXISTS (SELECT 1 FROM public.grupo_miembros WHERE aula_id = _g.aula_id AND user_id = _uid) THEN
    RAISE EXCEPTION 'Ya estás en un grupo de esta materia';
  END IF;
  IF EXISTS (SELECT 1 FROM public.solicitudes_grupo WHERE grupo_id = _grupo_id AND user_id = _uid AND estado = 'pendiente') THEN
    RAISE EXCEPTION 'Ya pediste unirte a este grupo';
  END IF;
  INSERT INTO public.solicitudes_grupo (grupo_id, aula_id, user_id) VALUES (_grupo_id, _g.aula_id, _uid)
  RETURNING id INTO _id;
  RETURN _id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolver_solicitud(_solicitud_id uuid, _aceptar boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _s public.solicitudes_grupo;
BEGIN
  SELECT * INTO _s FROM public.solicitudes_grupo WHERE id = _solicitud_id FOR UPDATE;
  IF _s.id IS NULL THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF _s.estado <> 'pendiente' THEN RAISE EXCEPTION 'Esta solicitud ya fue resuelta'; END IF;
  IF NOT public.puede_gestionar_grupo(_s.grupo_id, _uid) THEN
    RAISE EXCEPTION 'No tenés permiso para gestionar este grupo';
  END IF;
  IF _aceptar THEN
    PERFORM public.agregar_integrante(_s.grupo_id, _s.user_id);
    -- Ya tiene grupo: el resto de sus pedidos en esta materia dejan de tener sentido
    DELETE FROM public.solicitudes_grupo
      WHERE aula_id = _s.aula_id AND user_id = _s.user_id AND estado = 'pendiente' AND id <> _s.id;
  END IF;
  UPDATE public.solicitudes_grupo
    SET estado = CASE WHEN _aceptar THEN 'aceptada' ELSE 'rechazada' END,
        resuelta_por = _uid, resuelta_en = now()
    WHERE id = _s.id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.evaluar_par(uuid, uuid, int, int, int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.resumen_pares(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.solicitar_ingreso(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.resolver_solicitud(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evaluar_par(uuid, uuid, int, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resumen_pares(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.solicitar_ingreso(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_solicitud(uuid, boolean) TO authenticated;
