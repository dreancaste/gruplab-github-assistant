import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_grupos",
  title: "Listar mis grupos",
  description: "Lista los grupos y tableros a los que pertenece el usuario, con su aula.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_a, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("grupo_miembros")
      .select("grupos(id, nombre, es_independiente, nota_final, finalizado_en, aulas(nombre))")
      .eq("user_id", ctx.getUserId()!);
    if (error) throw new ToolError(error.message);
    const grupos = (data ?? []).flatMap((r) => {
      const g = r.grupos as unknown as { id: string; nombre: string; es_independiente: boolean; nota_final: number | null; finalizado_en: string | null; aulas: { nombre: string } | null } | null;
      return g ? [{ id: g.id, nombre: g.nombre, independiente: g.es_independiente, aula: g.aulas?.nombre ?? null, nota_final: g.nota_final, finalizado: g.finalizado_en !== null }] : [];
    });
    return {
      content: [{ type: "text", text: grupos.length ? grupos.map((g) => `${g.id}: ${g.nombre}${g.aula ? ` (${g.aula})` : ""}`).join("\n") : "No pertenecés a ningún grupo." }],
      structuredContent: { grupos },
    };
  },
});
