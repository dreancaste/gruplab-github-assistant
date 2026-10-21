
-- ============ Tipos ============
CREATE TYPE public.rol_aula AS ENUM ('admin', 'profesor', 'alumno');
CREATE TYPE public.estado_card AS ENUM ('backlog', 'progreso', 'revision', 'hecho');

-- ============ Perfiles ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ Aulas ============
CREATE TABLE public.aulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  codigo text NOT NULL UNIQUE,
  creador_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.aulas TO authenticated;
GRANT ALL ON public.aulas TO service_role;
ALTER TABLE public.aulas ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.aula_miembros (
  aula_id uuid NOT NULL REFERENCES public.aulas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rol public.rol_aula NOT NULL DEFAULT 'alumno',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (aula_id, user_id)
);
CREATE INDEX aula_miembros_user_idx ON public.aula_miembros(user_id);
GRANT SELECT, DELETE ON public.aula_miembros TO authenticated;
GRANT ALL ON public.aula_miembros TO service_role;
ALTER TABLE public.aula_miembros ENABLE ROW LEVEL SECURITY;

-- ============ Grupos / tableros ============
CREATE TABLE public.grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  aula_id uuid REFERENCES public.aulas(id) ON DELETE CASCADE,
  admin_id uuid,
  codigo text UNIQUE,
  es_independiente boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX grupos_aula_idx ON public.grupos(aula_id);
GRANT SELECT, UPDATE, DELETE ON public.grupos TO authenticated;
GRANT ALL ON public.grupos TO service_role;
ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.grupo_miembros (
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  aula_id uuid REFERENCES public.aulas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (grupo_id, user_id)
);
-- Regla: un alumno solo puede estar en un grupo por materia
CREATE UNIQUE INDEX grupo_miembros_un_grupo_por_aula ON public.grupo_miembros(aula_id, user_id) WHERE aula_id IS NOT NULL;
CREATE INDEX grupo_miembros_user_idx ON public.grupo_miembros(user_id);
GRANT SELECT ON public.grupo_miembros TO authenticated;
GRANT ALL ON public.grupo_miembros TO service_role;
ALTER TABLE public.grupo_miembros ENABLE ROW LEVEL SECURITY;

-- ============ Cards ============
CREATE TABLE public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descripcion text,
  estado public.estado_card NOT NULL DEFAULT 'backlog',
  orden double precision NOT NULL DEFAULT extract(epoch from now()) * 1000,
  puntuacion integer CHECK (puntuacion IS NULL OR (puntuacion >= 0 AND puntuacion <= 10)),
  comentario_profesor text,
  creado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cards_grupo_idx ON public.cards(grupo_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cards TO authenticated;
GRANT ALL ON public.cards TO service_role;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.card_adjuntos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  path text NOT NULL,
  nombre text NOT NULL,
  tamano bigint NOT NULL DEFAULT 0,
  tipo text,
  subido_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX card_adjuntos_card_idx ON public.card_adjuntos(card_id);
GRANT SELECT, INSERT, DELETE ON public.card_adjuntos TO authenticated;
GRANT ALL ON public.card_adjuntos TO service_role;
ALTER TABLE public.card_adjuntos ENABLE ROW LEVEL SECURITY;

-- ============ Log de actividad ============
CREATE TABLE public.actividad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  user_id uuid,
  accion text NOT NULL,
  entidad text NOT NULL,
  entidad_id uuid,
  detalle text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX actividad_grupo_idx ON public.actividad(grupo_id, created_at DESC);
GRANT SELECT ON public.actividad TO authenticated;
GRANT ALL ON public.actividad TO service_role;
ALTER TABLE public.actividad ENABLE ROW LEVEL SECURITY;

-- ============ Funciones de ayuda (security definer) ============
CREATE OR REPLACE FUNCTION public.rol_en_aula(_aula uuid, _user uuid)
RETURNS public.rol_aula LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rol FROM public.aula_miembros WHERE aula_id = _aula AND user_id = _user
$$;

CREATE OR REPLACE FUNCTION public.es_miembro_aula(_aula uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.aula_miembros WHERE aula_id = _aula AND user_id = _user)
$$;

CREATE OR REPLACE FUNCTION public.es_staff_aula(_aula uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.aula_miembros WHERE aula_id = _aula AND user_id = _user AND rol IN ('admin','profesor'))
$$;

CREATE OR REPLACE FUNCTION public.es_miembro_grupo(_grupo uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.grupo_miembros WHERE grupo_id = _grupo AND user_id = _user)
$$;

CREATE OR REPLACE FUNCTION public.es_staff_grupo(_grupo uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.grupos g
    JOIN public.aula_miembros m ON m.aula_id = g.aula_id
    WHERE g.id = _grupo AND m.user_id = _user AND m.rol IN ('admin','profesor')
  )
$$;

CREATE OR REPLACE FUNCTION public.puede_ver_grupo(_grupo uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.es_miembro_grupo(_grupo, _user) OR public.es_staff_grupo(_grupo, _user)
$$;

CREATE OR REPLACE FUNCTION public.puede_gestionar_grupo(_grupo uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.grupos WHERE id = _grupo AND admin_id = _user)
      OR public.es_staff_grupo(_grupo, _user)
$$;

CREATE OR REPLACE FUNCTION public.comparten_espacio(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.aula_miembros m1 JOIN public.aula_miembros m2 ON m1.aula_id = m2.aula_id
    WHERE m1.user_id = _a AND m2.user_id = _b
  ) OR EXISTS (
    SELECT 1 FROM public.grupo_miembros m1 JOIN public.grupo_miembros m2 ON m1.grupo_id = m2.grupo_id
    WHERE m1.user_id = _a AND m2.user_id = _b
  )
$$;

CREATE OR REPLACE FUNCTION public.generar_codigo()
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
  i int;
BEGIN
  LOOP
    c := '';
    FOR i IN 1..6 LOOP
      c := c || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.aulas WHERE codigo = c)
          AND NOT EXISTS (SELECT 1 FROM public.grupos WHERE codigo = c);
  END LOOP;
  RETURN c;
END;
$$;

-- ============ Políticas ============
CREATE POLICY "perfil propio o compartido" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.comparten_espacio(auth.uid(), id));
CREATE POLICY "editar perfil propio" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "ver aulas propias" ON public.aulas FOR SELECT TO authenticated
  USING (public.es_miembro_aula(id, auth.uid()));
CREATE POLICY "admin edita aula" ON public.aulas FOR UPDATE TO authenticated
  USING (public.rol_en_aula(id, auth.uid()) = 'admin') WITH CHECK (public.rol_en_aula(id, auth.uid()) = 'admin');
CREATE POLICY "admin elimina aula" ON public.aulas FOR DELETE TO authenticated
  USING (public.rol_en_aula(id, auth.uid()) = 'admin');

CREATE POLICY "ver miembros del aula" ON public.aula_miembros FOR SELECT TO authenticated
  USING (public.es_miembro_aula(aula_id, auth.uid()));
CREATE POLICY "admin quita o uno sale" ON public.aula_miembros FOR DELETE TO authenticated
  USING ((user_id = auth.uid() AND rol <> 'admin') OR (public.rol_en_aula(aula_id, auth.uid()) = 'admin' AND user_id <> auth.uid()));

CREATE POLICY "ver grupos" ON public.grupos FOR SELECT TO authenticated
  USING (public.es_miembro_grupo(id, auth.uid()) OR (aula_id IS NOT NULL AND public.es_miembro_aula(aula_id, auth.uid())));
CREATE POLICY "gestionar grupo" ON public.grupos FOR UPDATE TO authenticated
  USING (public.puede_gestionar_grupo(id, auth.uid())) WITH CHECK (public.puede_gestionar_grupo(id, auth.uid()));
CREATE POLICY "eliminar grupo" ON public.grupos FOR DELETE TO authenticated
  USING (public.puede_gestionar_grupo(id, auth.uid()));

CREATE POLICY "ver integrantes" ON public.grupo_miembros FOR SELECT TO authenticated
  USING (public.es_miembro_grupo(grupo_id, auth.uid()) OR (aula_id IS NOT NULL AND public.es_miembro_aula(aula_id, auth.uid())));

CREATE POLICY "ver cards" ON public.cards FOR SELECT TO authenticated
  USING (public.puede_ver_grupo(grupo_id, auth.uid()));
CREATE POLICY "crear cards" ON public.cards FOR INSERT TO authenticated
  WITH CHECK (public.puede_ver_grupo(grupo_id, auth.uid()));
CREATE POLICY "editar cards" ON public.cards FOR UPDATE TO authenticated
  USING (public.puede_ver_grupo(grupo_id, auth.uid())) WITH CHECK (public.puede_ver_grupo(grupo_id, auth.uid()));
CREATE POLICY "eliminar cards" ON public.cards FOR DELETE TO authenticated
  USING (public.puede_ver_grupo(grupo_id, auth.uid()));

CREATE POLICY "ver adjuntos" ON public.card_adjuntos FOR SELECT TO authenticated
  USING (public.puede_ver_grupo(grupo_id, auth.uid()));
CREATE POLICY "subir adjuntos" ON public.card_adjuntos FOR INSERT TO authenticated
  WITH CHECK (subido_por = auth.uid() AND public.puede_ver_grupo(grupo_id, auth.uid()));
CREATE POLICY "eliminar adjuntos" ON public.card_adjuntos FOR DELETE TO authenticated
  USING (subido_por = auth.uid() OR public.puede_gestionar_grupo(grupo_id, auth.uid()));

CREATE POLICY "ver actividad" ON public.actividad FOR SELECT TO authenticated
  USING (public.puede_ver_grupo(grupo_id, auth.uid()));

-- ============ Perfil al registrarse ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nombre)
  VALUES (
    NEW.id,
    coalesce(NEW.email, ''),
    coalesce(nullif(NEW.raw_user_meta_data->>'nombre',''), nullif(NEW.raw_user_meta_data->>'full_name',''),
             nullif(NEW.raw_user_meta_data->>'name',''), split_part(coalesce(NEW.email,''), '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ Reglas de cards ============
CREATE OR REPLACE FUNCTION public.cards_reglas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.creado_por := auth.uid();
    IF NOT public.es_staff_grupo(NEW.grupo_id, auth.uid()) THEN
      NEW.puntuacion := NULL;
      NEW.comentario_profesor := NULL;
    END IF;
  ELSE
    IF (NEW.puntuacion IS DISTINCT FROM OLD.puntuacion OR NEW.comentario_profesor IS DISTINCT FROM OLD.comentario_profesor)
       AND NOT public.es_staff_grupo(NEW.grupo_id, auth.uid()) THEN
      RAISE EXCEPTION 'Solo el docente puede puntuar o comentar';
    END IF;
    NEW.grupo_id := OLD.grupo_id;
    NEW.creado_por := OLD.creado_por;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER cards_reglas_trg BEFORE INSERT OR UPDATE ON public.cards
  FOR EACH ROW EXECUTE FUNCTION public.cards_reglas();

-- ============ Registro automático de actividad ============
CREATE OR REPLACE FUNCTION public.estado_label(_e public.estado_card)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _e WHEN 'backlog' THEN 'Backlog' WHEN 'progreso' THEN 'En progreso'
                 WHEN 'revision' THEN 'Revisión' ELSE 'Hecho' END
$$;

CREATE OR REPLACE FUNCTION public.log_cards()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    END IF;
    IF NEW.puntuacion IS DISTINCT FROM OLD.puntuacion OR NEW.comentario_profesor IS DISTINCT FROM OLD.comentario_profesor THEN
      INSERT INTO public.actividad (grupo_id, user_id, accion, entidad, entidad_id, detalle)
      VALUES (NEW.grupo_id, auth.uid(), 'puntuar', 'card', NEW.id,
              NEW.titulo || coalesce(' · ' || NEW.puntuacion::text || '/10', ''));
    END IF;
    IF NEW.titulo IS DISTINCT FROM OLD.titulo OR NEW.descripcion IS DISTINCT FROM OLD.descripcion THEN
      INSERT INTO public.actividad (grupo_id, user_id, accion, entidad, entidad_id, detalle)
      VALUES (NEW.grupo_id, auth.uid(), 'editar', 'card', NEW.id, NEW.titulo);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;
CREATE TRIGGER log_cards_trg AFTER INSERT OR UPDATE OR DELETE ON public.cards
  FOR EACH ROW EXECUTE FUNCTION public.log_cards();

CREATE OR REPLACE FUNCTION public.log_adjuntos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.actividad (grupo_id, user_id, accion, entidad, entidad_id, detalle)
  VALUES (NEW.grupo_id, auth.uid(), 'adjuntar', 'adjunto', NEW.card_id, NEW.nombre);
  RETURN NEW;
END;
$$;
CREATE TRIGGER log_adjuntos_trg AFTER INSERT ON public.card_adjuntos
  FOR EACH ROW EXECUTE FUNCTION public.log_adjuntos();

CREATE OR REPLACE FUNCTION public.log_miembros()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _nombre text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT nombre INTO _nombre FROM public.profiles WHERE id = NEW.user_id;
    INSERT INTO public.actividad (grupo_id, user_id, accion, entidad, entidad_id, detalle)
    VALUES (NEW.grupo_id, auth.uid(), 'sumar_integrante', 'integrante', NEW.user_id, _nombre);
    RETURN NEW;
  ELSE
    IF EXISTS (SELECT 1 FROM public.grupos WHERE id = OLD.grupo_id) THEN
      SELECT nombre INTO _nombre FROM public.profiles WHERE id = OLD.user_id;
      INSERT INTO public.actividad (grupo_id, user_id, accion, entidad, entidad_id, detalle)
      VALUES (OLD.grupo_id, auth.uid(), 'quitar_integrante', 'integrante', OLD.user_id, _nombre);
    END IF;
    RETURN OLD;
  END IF;
END;
$$;
CREATE TRIGGER log_miembros_trg AFTER INSERT OR DELETE ON public.grupo_miembros
  FOR EACH ROW EXECUTE FUNCTION public.log_miembros();

-- ============ Acciones (RPC) ============
CREATE OR REPLACE FUNCTION public.crear_aula(_nombre text, _descripcion text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Necesitás iniciar sesión'; END IF;
  IF coalesce(trim(_nombre), '') = '' THEN RAISE EXCEPTION 'El nombre es obligatorio'; END IF;
  INSERT INTO public.aulas (nombre, descripcion, codigo, creador_id)
  VALUES (trim(_nombre), nullif(trim(coalesce(_descripcion,'')), ''), public.generar_codigo(), _uid)
  RETURNING id INTO _id;
  INSERT INTO public.aula_miembros (aula_id, user_id, rol) VALUES (_id, _uid, 'admin');
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unirse_con_codigo(_codigo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _c text := upper(trim(_codigo)); _aula uuid; _grupo uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Necesitás iniciar sesión'; END IF;
  SELECT id INTO _aula FROM public.aulas WHERE codigo = _c;
  IF _aula IS NOT NULL THEN
    IF public.es_miembro_aula(_aula, _uid) THEN RAISE EXCEPTION 'Ya estás inscripto en esta materia'; END IF;
    INSERT INTO public.aula_miembros (aula_id, user_id, rol) VALUES (_aula, _uid, 'alumno');
    RETURN jsonb_build_object('tipo', 'aula', 'id', _aula);
  END IF;
  SELECT id INTO _grupo FROM public.grupos WHERE codigo = _c AND es_independiente;
  IF _grupo IS NOT NULL THEN
    IF public.es_miembro_grupo(_grupo, _uid) THEN RAISE EXCEPTION 'Ya estás en este tablero'; END IF;
    INSERT INTO public.grupo_miembros (grupo_id, user_id, aula_id) VALUES (_grupo, _uid, NULL);
    RETURN jsonb_build_object('tipo', 'tablero', 'id', _grupo);
  END IF;
  RAISE EXCEPTION 'Código inválido';
END;
$$;

CREATE OR REPLACE FUNCTION public.crear_grupo(_aula_id uuid, _nombre text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _rol public.rol_aula; _id uuid;
BEGIN
  _rol := public.rol_en_aula(_aula_id, _uid);
  IF _rol IS NULL THEN RAISE EXCEPTION 'No participás de esta materia'; END IF;
  IF coalesce(trim(_nombre), '') = '' THEN RAISE EXCEPTION 'El nombre es obligatorio'; END IF;
  IF _rol = 'alumno' AND EXISTS (SELECT 1 FROM public.grupo_miembros WHERE aula_id = _aula_id AND user_id = _uid) THEN
    RAISE EXCEPTION 'Ya estás en un grupo de esta materia';
  END IF;
  INSERT INTO public.grupos (nombre, aula_id, admin_id, es_independiente)
  VALUES (trim(_nombre), _aula_id, CASE WHEN _rol = 'alumno' THEN _uid ELSE NULL END, false)
  RETURNING id INTO _id;
  IF _rol = 'alumno' THEN
    INSERT INTO public.grupo_miembros (grupo_id, user_id, aula_id) VALUES (_id, _uid, _aula_id);
  END IF;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.crear_tablero(_nombre text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Necesitás iniciar sesión'; END IF;
  IF coalesce(trim(_nombre), '') = '' THEN RAISE EXCEPTION 'El nombre es obligatorio'; END IF;
  INSERT INTO public.grupos (nombre, aula_id, admin_id, codigo, es_independiente)
  VALUES (trim(_nombre), NULL, _uid, public.generar_codigo(), true)
  RETURNING id INTO _id;
  INSERT INTO public.grupo_miembros (grupo_id, user_id, aula_id) VALUES (_id, _uid, NULL);
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.agregar_integrante(_grupo_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _g public.grupos;
BEGIN
  SELECT * INTO _g FROM public.grupos WHERE id = _grupo_id;
  IF _g.id IS NULL THEN RAISE EXCEPTION 'Grupo no encontrado'; END IF;
  IF _g.aula_id IS NULL THEN RAISE EXCEPTION 'A los tableros independientes se suman con el código'; END IF;
  IF NOT public.puede_gestionar_grupo(_grupo_id, _uid) THEN RAISE EXCEPTION 'No tenés permiso para gestionar este grupo'; END IF;
  IF public.rol_en_aula(_g.aula_id, _user_id) IS DISTINCT FROM 'alumno' THEN
    RAISE EXCEPTION 'Solo se pueden sumar alumnos de la materia';
  END IF;
  IF EXISTS (SELECT 1 FROM public.grupo_miembros WHERE aula_id = _g.aula_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Ese alumno ya está en un grupo de esta materia';
  END IF;
  INSERT INTO public.grupo_miembros (grupo_id, user_id, aula_id) VALUES (_grupo_id, _user_id, _g.aula_id);
  IF _g.admin_id IS NULL THEN UPDATE public.grupos SET admin_id = _user_id WHERE id = _grupo_id; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._remover_integrante(_grupo_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _g public.grupos; _nuevo uuid;
BEGIN
  SELECT * INTO _g FROM public.grupos WHERE id = _grupo_id;
  DELETE FROM public.grupo_miembros WHERE grupo_id = _grupo_id AND user_id = _user_id;
  SELECT user_id INTO _nuevo FROM public.grupo_miembros WHERE grupo_id = _grupo_id ORDER BY created_at LIMIT 1;
  IF _nuevo IS NULL THEN
    IF _g.es_independiente THEN
      DELETE FROM public.grupos WHERE id = _grupo_id;
      RETURN true;
    END IF;
    UPDATE public.grupos SET admin_id = NULL WHERE id = _grupo_id;
    RETURN false;
  END IF;
  IF _g.admin_id = _user_id THEN UPDATE public.grupos SET admin_id = _nuevo WHERE id = _grupo_id; END IF;
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public._remover_integrante(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.quitar_integrante(_grupo_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id <> auth.uid() AND NOT public.puede_gestionar_grupo(_grupo_id, auth.uid()) THEN
    RAISE EXCEPTION 'No tenés permiso para gestionar este grupo';
  END IF;
  IF NOT public.es_miembro_grupo(_grupo_id, _user_id) THEN RAISE EXCEPTION 'No es integrante del grupo'; END IF;
  RETURN public._remover_integrante(_grupo_id, _user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.transferir_admin(_grupo_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.puede_gestionar_grupo(_grupo_id, auth.uid()) THEN RAISE EXCEPTION 'No tenés permiso'; END IF;
  IF NOT public.es_miembro_grupo(_grupo_id, _user_id) THEN RAISE EXCEPTION 'Debe ser integrante del grupo'; END IF;
  UPDATE public.grupos SET admin_id = _user_id WHERE id = _grupo_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cambiar_rol_aula(_aula_id uuid, _user_id uuid, _rol public.rol_aula)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _gid uuid;
BEGIN
  IF public.rol_en_aula(_aula_id, auth.uid()) IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Solo el admin del aula puede cambiar roles'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'No podés cambiar tu propio rol'; END IF;
  IF NOT public.es_miembro_aula(_aula_id, _user_id) THEN RAISE EXCEPTION 'No participa de esta materia'; END IF;
  UPDATE public.aula_miembros SET rol = _rol WHERE aula_id = _aula_id AND user_id = _user_id;
  IF _rol <> 'alumno' THEN
    FOR _gid IN SELECT grupo_id FROM public.grupo_miembros WHERE aula_id = _aula_id AND user_id = _user_id LOOP
      PERFORM public._remover_integrante(_gid, _user_id);
    END LOOP;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.salir_de_aula(_aula_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _gid uuid;
BEGIN
  IF public.rol_en_aula(_aula_id, _uid) = 'admin' THEN RAISE EXCEPTION 'El admin no puede salir del aula; podés eliminarla'; END IF;
  FOR _gid IN SELECT grupo_id FROM public.grupo_miembros WHERE aula_id = _aula_id AND user_id = _uid LOOP
    PERFORM public._remover_integrante(_gid, _uid);
  END LOOP;
  DELETE FROM public.aula_miembros WHERE aula_id = _aula_id AND user_id = _uid;
END;
$$;

-- Permisos de ejecución
REVOKE EXECUTE ON FUNCTION public.crear_aula(text, text), public.unirse_con_codigo(text), public.crear_grupo(uuid, text),
  public.crear_tablero(text), public.agregar_integrante(uuid, uuid), public.quitar_integrante(uuid, uuid),
  public.transferir_admin(uuid, uuid), public.cambiar_rol_aula(uuid, uuid, public.rol_aula), public.salir_de_aula(uuid),
  public.generar_codigo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_aula(text, text), public.unirse_con_codigo(text), public.crear_grupo(uuid, text),
  public.crear_tablero(text), public.agregar_integrante(uuid, uuid), public.quitar_integrante(uuid, uuid),
  public.transferir_admin(uuid, uuid), public.cambiar_rol_aula(uuid, uuid, public.rol_aula), public.salir_de_aula(uuid)
  TO authenticated;

-- ============ Archivos adjuntos (almacenamiento) ============
CREATE POLICY "adjuntos ver" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'adjuntos' AND public.puede_ver_grupo(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY "adjuntos subir" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'adjuntos' AND public.puede_ver_grupo(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY "adjuntos borrar" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'adjuntos' AND public.puede_ver_grupo(((storage.foldername(name))[1])::uuid, auth.uid()));

-- ============ Tiempo real ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.actividad;
ALTER PUBLICATION supabase_realtime ADD TABLE public.card_adjuntos;
