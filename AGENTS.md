<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules

- GrupLab is a TanStack Start rebuild of the Angular/Amplify repos `dreancaste/gruplab` and its update `dreancaste/gruplab-pp3`; keep its domain model (aulas, grupos, cards, actividad) and Spanish UI copy so it stays recognizable to its users.
- Multi-row or permission-sensitive writes (create aula/grupo/tablero, join by code, add/remove members, role changes) go through SECURITY DEFINER RPCs in Postgres, not client inserts — they enforce rules like "one group per aula" atomically.
- The activity log is written only by database triggers on cards, card_adjuntos and grupo_miembros (no client insert policy), so participation numbers cannot be faked from the browser.
- Grading fields (puntuacion, comentario_profesor) are guarded by a BEFORE trigger that only lets aula staff change them; keep UI checks as convenience only.
- Participation math lives in `src/lib/participacion.ts` (and due-date alerts in `src/lib/vencimiento.ts`) as pure functions with tests; change them there, not inside components.
- Task workflow rules (review before Hecho, frozen effort/assignees, completion/review timestamps) are enforced in the `cards_reglas` BEFORE trigger; UI pre-checks only give friendlier messages.
- Peer evaluations are written only via the `evaluar_par` RPC and read by groups only as anonymous averages through `resumen_pares`; raw rows are visible to the evaluator and aula staff only.
- Group join requests (`solicitudes_grupo`) are created/resolved only through `solicitar_ingreso` / `resolver_solicitud` RPCs.
- Attachments live in the private `adjuntos` bucket under `{grupo_id}/{card_id}/...`; storage policies key off the first path segment, so keep that layout.
- Signed-in pages live under `src/routes/_authenticated/` and read data with the browser client (RLS applies) via queryOptions in `src/lib/gruplab.ts`.
