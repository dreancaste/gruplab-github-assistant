-- Nota final y cierre del trabajo del grupo (solo docentes del aula)
ALTER TABLE public.grupos
  ADD COLUMN IF NOT EXISTS nota_final numeric(3,1),
  ADD COLUMN IF NOT EXISTS comentario_final text,
  ADD COLUMN IF NOT EXISTS finalizado_en timestamptz,
  ADD COLUMN IF NOT EXISTS finalizado_por uuid;

ALTER TABLE public.grupos
  ADD CONSTRAINT grupos_nota_final_rango CHECK (nota_final IS NULL OR (nota_final >= 0 AND nota_final <= 10));

CREATE OR REPLACE FUNCTION public.grupo_finalizado(_grupo uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.grupos WHERE id = _grupo AND finalizado_en IS NOT NULL)
$$;
GRANT EXECUTE ON FUNCTION public.grupo_finalizado(uuid) TO authenticated;

-- Los campos de cierre solo cambian a través de las funciones de abajo
CREATE OR REPLACE FUNCTION public.grupos_guardar_cierre()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('gruplab.cierre', true) IS DISTINCT FROM 'on' AND (
       NEW.nota_final IS DISTINCT FROM OLD.nota_final
    OR NEW.comentario_final IS DISTINCT FROM OLD.comentario_final
    OR NEW.finalizado_en IS DISTINCT FROM OLD.finalizado_en
    OR NEW.finalizado_por IS DISTINCT FROM OLD.finalizado_por) THEN
    RAISE EXCEPTION 'La nota final solo la puede cargar el docente desde «Finalizar trabajo»';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.grupos_guardar_cierre() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS grupos_guardar_cierre_trg ON public.grupos;
CREATE TRIGGER grupos_guardar_cierre_trg BEFORE UPDATE ON public.grupos
  FOR EACH ROW EXECUTE FUNCTION public.grupos_guardar_cierre();

CREATE OR REPLACE FUNCTION public.finalizar_grupo(_grupo_id uuid, _nota numeric, _comentario text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _g public.grupos;
BEGIN
  SELECT * INTO _g FROM public.grupos WHERE id = _grupo_id;
  IF _g.id IS NULL THEN RAISE EXCEPTION 'No encontramos el grupo'; END IF;
  IF _g.aula_id IS NULL OR NOT public.es_staff_grupo(_grupo_id, _uid) THEN
    RAISE EXCEPTION 'Solo el docente del aula puede finalizar el trabajo';
  END IF;
  IF _nota IS NULL OR _nota < 0 OR _nota > 10 THEN
    RAISE EXCEPTION 'La nota final tiene que estar entre 0 y 10';
  END IF;
  PERFORM set_config('gruplab.cierre', 'on', true);
  UPDATE public.grupos
     SET nota_final = round(_nota, 1),
         comentario_final = nullif(btrim(coalesce(_comentario, '')), ''),
         finalizado_en = now(),
         finalizado_por = _uid
   WHERE id = _grupo_id;
  PERFORM set_config('gruplab.cierre', 'off', true);
  INSERT INTO public.actividad (grupo_id, user_id, accion, entidad, entidad_id, detalle)
  VALUES (_grupo_id, _uid, CASE WHEN _g.finalizado_en IS NULL THEN 'finalizar_grupo' ELSE 'editar_nota_final' END,
          'grupo', _grupo_id, 'Nota final: ' || round(_nota, 1)::text);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.finalizar_grupo(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalizar_grupo(uuid, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reabrir_grupo(_grupo_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF NOT public.es_staff_grupo(_grupo_id, _uid) THEN
    RAISE EXCEPTION 'Solo el docente del aula puede reabrir el trabajo';
  END IF;
  IF NOT public.grupo_finalizado(_grupo_id) THEN
    RAISE EXCEPTION 'El trabajo no está finalizado';
  END IF;
  PERFORM set_config('gruplab.cierre', 'on', true);
  UPDATE public.grupos
     SET nota_final = NULL, comentario_final = NULL, finalizado_en = NULL, finalizado_por = NULL
   WHERE id = _grupo_id;
  PERFORM set_config('gruplab.cierre', 'off', true);
  INSERT INTO public.actividad (grupo_id, user_id, accion, entidad, entidad_id, detalle)
  VALUES (_grupo_id, _uid, 'reabrir_grupo', 'grupo', _grupo_id, NULL);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reabrir_grupo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reabrir_grupo(uuid) TO authenticated;

-- Con el trabajo finalizado, el tablero queda en solo lectura para los alumnos
CREATE OR REPLACE FUNCTION public.bloqueo_grupo_finalizado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _grupo uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.grupo_id ELSE NEW.grupo_id END;
BEGIN
  IF auth.uid() IS NOT NULL
     AND public.grupo_finalizado(_grupo)
     AND NOT public.es_staff_grupo(_grupo, auth.uid()) THEN
    RAISE EXCEPTION 'El trabajo está finalizado: el tablero quedó en solo lectura';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.bloqueo_grupo_finalizado() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS cards_bloqueo_finalizado_trg ON public.cards;
CREATE TRIGGER cards_bloqueo_finalizado_trg BEFORE INSERT OR UPDATE OR DELETE ON public.cards
  FOR EACH ROW EXECUTE FUNCTION public.bloqueo_grupo_finalizado();
DROP TRIGGER IF EXISTS adjuntos_bloqueo_finalizado_trg ON public.card_adjuntos;
CREATE TRIGGER adjuntos_bloqueo_finalizado_trg BEFORE INSERT OR DELETE ON public.card_adjuntos
  FOR EACH ROW EXECUTE FUNCTION public.bloqueo_grupo_finalizado();

DROP POLICY IF EXISTS "adjuntos subir" ON storage.objects;
CREATE POLICY "adjuntos subir" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'adjuntos'
    AND public.puede_ver_grupo(((storage.foldername(name))[1])::uuid, auth.uid())
    AND (NOT public.grupo_finalizado(((storage.foldername(name))[1])::uuid)
         OR public.es_staff_grupo(((storage.foldername(name))[1])::uuid, auth.uid())));
DROP POLICY IF EXISTS "adjuntos borrar" ON storage.objects;
CREATE POLICY "adjuntos borrar" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'adjuntos'
    AND public.puede_ver_grupo(((storage.foldername(name))[1])::uuid, auth.uid())
    AND (NOT public.grupo_finalizado(((storage.foldername(name))[1])::uuid)
         OR public.es_staff_grupo(((storage.foldername(name))[1])::uuid, auth.uid())));