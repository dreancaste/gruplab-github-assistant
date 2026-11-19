import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listarGrupos from "./tools/listar-grupos";
import listarTareas from "./tools/listar-tareas";
import crearTarea from "./tools/crear-tarea";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "gruplab",
  title: "Gruplab",
  version: "0.1.0",
  instructions: "Herramientas de GrupLab: ver tus grupos, ver sus tareas y crear tareas nuevas.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listarGrupos, listarTareas, crearTarea],
});
