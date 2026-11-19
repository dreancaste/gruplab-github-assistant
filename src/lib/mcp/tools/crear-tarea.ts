import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "crear_tarea",
  title: "Crear tarea",
  description: "Crea una tarea nueva en el backlog de un grupo del usuario.",
  inputSchema: {
    grupo_id: z.string().uuid().describe("ID del grupo."),
    titulo: z.string().min(1).max(200).describe("Título de la tarea."),
    descripcion: z.string().max(4000).optional().describe("Descripción opcional."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ grupo_id, titulo, descripcion }, ctx) => {
    const { data, error } = await supabaseForUser(ctx)
      .from("cards")
      .insert({ grupo_id, titulo, descripcion: descripcion ?? null, creado_por: ctx.getUserId() })
      .select("id, titulo, estado")
      .single();
    if (error) throw new ToolError(error.message);
    return { content: [{ type: "text", text: `Tarea creada: ${data.id} (${data.titulo})` }], structuredContent: { tarea: data } };
  },
});
