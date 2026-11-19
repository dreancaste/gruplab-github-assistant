import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_tareas",
  title: "Listar tareas de un grupo",
  description: "Lista las tareas (cards) de un grupo con su estado, fecha límite y esfuerzo.",
  inputSchema: { grupo_id: z.string().uuid().describe("ID del grupo (de listar_grupos).") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ grupo_id }, ctx) => {
    const { data, error } = await supabaseForUser(ctx)
      .from("cards")
      .select("id, titulo, estado, fecha_limite, peso_esfuerzo, asignados, puntuacion")
      .eq("grupo_id", grupo_id)
      .order("orden")
      .limit(200);
    if (error) throw new ToolError(error.message);
    const tareas = (data ?? []).map((c) => ({ ...c, asignados: [...c.asignados] }));
    return {
      content: [{ type: "text", text: tareas.length ? tareas.map((t) => `${t.id}: [${t.estado}] ${t.titulo}`).join("\n") : "El grupo no tiene tareas o no tenés acceso." }],
      structuredContent: { tareas },
    };
  },
});
