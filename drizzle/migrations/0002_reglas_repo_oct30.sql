-- Reglas de tareas actualizadas (repo gruplab, 30/10):
--  * Tableros independientes o grupos de 1 persona: se completa sin revisión y se autoasigna.
--  * Si todo el grupo está asignado, cualquiera del grupo puede revisar.
--  * El docente puede revisar.
--  * Al pasar a Hecho sin revisión previa, si quien la mueve podía revisarla, cuenta como revisión.
--  * Responsables por defecto al crear: docente -> todo el grupo; tablero de una persona -> esa persona.
CREATE OR REPLACE FUNCTION public.cards_reglas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _staff boolean;
  _es_docente boolean;
  _a uuid;
  _g public.grupos;
  _miembros uuid[];
  _individual boolean;
  _todos boolean;
BEGIN
  _es_docente := _uid IS NOT NULL AND public.es_staff_grupo(NEW.grupo_id, _uid);
  _staff := _uid IS NULL OR _es_docente;
  NEW.asignados := coalesce(ARRAY(SELECT DISTINCT x FROM unnest(NEW.asignados) x WHERE x IS NOT NULL), '{}');
  FOREACH _a IN ARRAY NEW.asignados LOOP
    IF NOT public.es_miembro_grupo(NEW.grupo_id, _a) THEN
      RAISE EXCEPTION 'Solo podés asignar integrantes del grupo';
    END IF;
  END LOOP;

  SELECT * INTO _g FROM public.grupos WHERE id = NEW.grupo_id;
  _miembros := coalesce(ARRAY(SELECT user_id FROM public.grupo_miembros WHERE grupo_id = NEW.grupo_id ORDER BY created_at), '{}');
  _individual := coalesce(_g.es_independiente, false) OR cardinality(_miembros) <= 1;

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
    IF cardinality(NEW.asignados) = 0 AND cardinality(_miembros) > 0 THEN
      IF coalesce(_g.es_independiente, false) AND cardinality(_miembros) = 1 THEN
        NEW.asignados := _miembros;
      ELSIF _es_docente THEN
        NEW.asignados := _miembros;
      END IF;
    END IF;
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

  _todos := cardinality(_miembros) > 0 AND _miembros <@ NEW.asignados;

  -- Revisión manual (tarea en Revisión)
  IF NEW.revisada_por IS DISTINCT FROM OLD.revisada_por THEN
    IF NEW.revisada_por IS NOT NULL THEN
      IF _uid IS NOT NULL AND NEW.revisada_por <> _uid THEN
        RAISE EXCEPTION 'Solo podés registrar tu propia revisión';
      END IF;
      IF OLD.estado <> 'revision' OR NEW.estado <> 'revision' THEN
        RAISE EXCEPTION 'Solo se pueden revisar tareas que están en Revisión';
      END IF;
      IF NOT (NEW.revisada_por = ANY (_miembros) OR public.es_staff_grupo(NEW.grupo_id, NEW.revisada_por)) THEN
        RAISE EXCEPTION 'Solo los integrantes del grupo o el docente pueden revisar tareas';
      END IF;
      IF NEW.revisada_por = ANY (NEW.asignados) AND NOT _todos THEN
        RAISE EXCEPTION 'La revisión debe hacerla alguien que no esté asignado a la tarea';
      END IF;
      NEW.revisada_en := now();
    ELSE
      NEW.revisada_en := NULL;
    END IF;
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    IF NEW.estado = 'hecho' THEN
      IF _individual THEN
        IF cardinality(NEW.asignados) = 0 AND cardinality(_miembros) > 0 THEN
          NEW.asignados := ARRAY[CASE WHEN _uid = ANY (_miembros) THEN _uid ELSE _miembros[1] END];
        END IF;
      ELSE
        IF cardinality(NEW.asignados) = 0 THEN
          RAISE EXCEPTION 'Asigná al menos una persona antes de completar la tarea';
        END IF;
        _todos := _miembros <@ NEW.asignados;
        IF NOT (NEW.revisada_por IS NOT NULL AND (_todos OR NOT (NEW.revisada_por = ANY (NEW.asignados)))) THEN
          IF _uid IS NOT NULL AND (_es_docente OR (_uid = ANY (_miembros) AND (NOT (_uid = ANY (NEW.asignados)) OR _todos))) THEN
            NEW.revisada_por := _uid;
            NEW.revisada_en := now();
          ELSE
            RAISE EXCEPTION 'Antes de completar, otra persona del grupo tiene que revisar la tarea';
          END IF;
        END IF;
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

-- Evaluación entre pares: volver a evaluar actualiza la evaluación anterior
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
  INSERT INTO public.evaluaciones_pares (grupo_id, card_id, evaluador_id, evaluado_id, coordinacion, comunicacion, responsabilidad)
  VALUES (_c.grupo_id, _card_id, _uid, _evaluado_id, _coordinacion, _comunicacion, _responsabilidad)
  ON CONFLICT (card_id, evaluador_id, evaluado_id) DO UPDATE
    SET coordinacion = EXCLUDED.coordinacion,
        comunicacion = EXCLUDED.comunicacion,
        responsabilidad = EXCLUDED.responsabilidad,
        created_at = now();
END;
$function$;

-- Crear grupo con integrantes iniciales (docente arma el grupo de una vez)
CREATE OR REPLACE FUNCTION public.crear_grupo_con_integrantes(_aula_id uuid, _nombre text, _integrantes uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _id uuid; _u uuid;
BEGIN
  _id := public.crear_grupo(_aula_id, _nombre);
  FOREACH _u IN ARRAY coalesce(ARRAY(SELECT DISTINCT x FROM unnest(_integrantes) x WHERE x IS NOT NULL AND x <> auth.uid()), '{}') LOOP
    PERFORM public.agregar_integrante(_id, _u);
  END LOOP;
  RETURN _id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.crear_grupo_con_integrantes(uuid, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_grupo_con_integrantes(uuid, text, uuid[]) TO authenticated;

-- Registro de actividad del grupo: creación y cambio de nombre
CREATE OR REPLACE FUNCTION public.log_grupos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.actividad (grupo_id, user_id, accion, entidad, entidad_id, detalle)
    VALUES (NEW.id, auth.uid(), 'crear_grupo', 'grupo', NEW.id, NEW.nombre);
  ELSIF NEW.nombre IS DISTINCT FROM OLD.nombre THEN
    INSERT INTO public.actividad (grupo_id, user_id, accion, entidad, entidad_id, detalle)
    VALUES (NEW.id, auth.uid(), 'editar_grupo', 'grupo', NEW.id, OLD.nombre || ' → ' || NEW.nombre);
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.log_grupos() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS log_grupos_trg ON public.grupos;
CREATE TRIGGER log_grupos_trg AFTER INSERT OR UPDATE OF nombre ON public.grupos
  FOR EACH ROW EXECUTE FUNCTION public.log_grupos();