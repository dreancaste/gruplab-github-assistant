import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Det = { client?: { name?: string; redirect_uri?: string } | null; scope?: string; redirect_url?: string; redirect_to?: string; user?: { email?: string } };
type Res = Promise<{ data: Det | null; error: { message: string } | null }>;
const oauth = (supabase.auth as unknown as { oauth: {
  getAuthorizationDetails: (id: string) => Res;
  approveAuthorization: (id: string) => Res;
  denyAuthorization: (id: string) => Res;
} }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  head: () => ({ meta: [{ title: "Conectar app — GrupLab" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Falta el identificador de autorización.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { redirect: location.pathname + location.searchStr } });
  },
  loaderDeps: ({ search }) => ({ id: search.authorization_id }),
  loader: async ({ deps }) => {
    const { data, error } = await oauth.getAuthorizationDetails(deps.id);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    const { data: s } = await supabase.auth.getSession();
    return { details: data, email: s.session?.user.email ?? "" };
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="dot-grid flex min-h-screen items-center justify-center bg-background p-4">
      <div className="brut max-w-md rounded-2xl bg-card p-8 text-center">
        <h1 className="text-xl font-bold">No pudimos cargar esta solicitud</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
      </div>
    </main>
  ),
});

function Consent() {
  const { details, email } = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cliente = details?.client?.name ?? "Una app";

  async function decidir(aprobar: boolean) {
    setBusy(true);
    setErr(null);
    const { data, error } = aprobar ? await oauth.approveAuthorization(authorization_id) : await oauth.denyAuthorization(authorization_id);
    const target = data?.redirect_url ?? data?.redirect_to;
    if (error || !target) { setBusy(false); setErr(error?.message ?? "No recibimos a dónde volver."); return; }
    window.location.href = target;
  }

  return (
    <main className="dot-grid flex min-h-screen items-center justify-center bg-background p-4">
      <div className="brut w-full max-w-md rounded-3xl bg-card p-8">
        <h1 className="text-2xl font-extrabold">Conectar {cliente} a GrupLab</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sesión iniciada como <b>{email}</b>.</p>
        <p className="mt-4">{cliente} va a poder usar GrupLab como vos: ver tus grupos y tareas y crear tareas nuevas.</p>
        {details?.client?.redirect_uri && <p className="mt-2 break-all text-xs text-muted-foreground">Vuelve a: {details.client.redirect_uri}</p>}
        <p className="mt-3 text-xs text-muted-foreground">Esto no saltea los permisos de GrupLab: solo ve lo que vos podés ver.</p>
        {err && <p role="alert" className="mt-3 text-sm text-destructive">{err}</p>}
        <div className="mt-6 grid gap-2">
          <Button disabled={busy} onClick={() => decidir(true)}>Permitir</Button>
          <Button variant="outline" disabled={busy} onClick={() => decidir(false)}>Cancelar conexión</Button>
        </div>
      </div>
    </main>
  );
}
