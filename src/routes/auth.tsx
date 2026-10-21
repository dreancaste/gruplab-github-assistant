import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import "@lovable.dev/cloud-auth-js/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/gruplab/Logo";

type Modo = "ingreso" | "registro" | "olvide";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { modo?: Modo | undefined; redirect?: string | undefined } => ({
    modo: s["modo"] === "registro" || s["modo"] === "olvide" ? (s["modo"] as Modo) : undefined,
    redirect: typeof s["redirect"] === "string" ? (s["redirect"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Ingresar — GrupLab" },
      { name: "description", content: "Ingresá o creá tu cuenta de GrupLab." },
      { property: "og:title", content: "Ingresar — GrupLab" },
      { property: "og:description", content: "Ingresá o creá tu cuenta de GrupLab." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function destinoSeguro(r?: string) {
  if (!r) return "/espacios";
  try {
    const u = new URL(r, window.location.origin);
    if (u.origin !== window.location.origin) return "/espacios";
    return u.pathname + u.search;
  } catch {
    return "/espacios";
  }
}

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [modo, setModo] = useState<Modo>(search.modo ?? "ingreso");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [enviado, setEnviado] = useState<null | "registro" | "olvide">(null);

  const irADestino = () => {
    const guardado = sessionStorage.getItem("gruplab:redirect") ?? undefined;
    sessionStorage.removeItem("gruplab:redirect");
    navigate({ to: destinoSeguro(search.redirect ?? guardado), replace: true });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) irADestino();
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) irADestino();
    });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    try {
      if (modo === "ingreso") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (modo === "registro") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/espacios", data: { nombre } },
        });
        if (error) throw error;
        if (!data.session) setEnviado("registro");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        setEnviado("olvide");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Algo salió mal";
      toast.error(
        msg.includes("Invalid login credentials")
          ? "Email o contraseña incorrectos"
          : msg.includes("already registered")
            ? "Ese email ya tiene cuenta. Probá ingresar."
            : msg,
      );
    } finally {
      setCargando(false);
    }
  }

  async function social(provider: "google" | "lovable") {
    if (search.redirect) sessionStorage.setItem("gruplab:redirect", destinoSeguro(search.redirect));
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin + "/auth",
    });
    if (result.error) {
      toast.error("No pudimos iniciar sesión. Probá de nuevo.");
      return;
    }
    if (result.redirected) return;
    irADestino();
  }

  const titulo =
    modo === "ingreso" ? "Hola de nuevo" : modo === "registro" ? "Creá tu cuenta" : "Recuperar acceso";

  return (
    <div className="dot-grid flex min-h-screen flex-col bg-background">
      <header className="mx-auto w-full max-w-6xl px-5 py-5">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="brut w-full max-w-md rounded-3xl bg-card p-7 sm:p-9">
          {enviado ? (
            <div className="text-center">
              <span className="brut-sm mx-auto grid h-14 w-14 place-items-center rounded-xl bg-sun">
                <MailCheck className="h-7 w-7" />
              </span>
              <h1 className="mt-5 text-3xl font-extrabold">Revisá tu mail</h1>
              <p className="mt-2 text-muted-foreground">
                {enviado === "registro"
                  ? `Te enviamos un enlace a ${email} para confirmar tu cuenta.`
                  : `Te enviamos un enlace a ${email} para elegir una nueva contraseña.`}
              </p>
              <Button
                variant="outline"
                className="mt-6"
                onClick={() => {
                  setEnviado(null);
                  setModo("ingreso");
                }}
              >
                Volver a ingresar
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-extrabold">{titulo}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {modo === "olvide"
                  ? "Te mandamos un enlace para elegir una contraseña nueva."
                  : "Organizá tus trabajos grupales en un solo lugar."}
              </p>

              {modo !== "olvide" && (
                <div className="mt-6 grid gap-2.5">
                  <Button variant="outline" type="button" onClick={() => social("google")}>
                    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
                      <path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.45-1.7 4.25-5.35 4.25-3.22 0-5.85-2.67-5.85-5.95S8.78 6.43 12 6.43c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 3.9 14.55 3 12 3 7.03 3 3 7.03 3 12s4.03 9 9 9c5.2 0 8.64-3.65 8.64-8.8 0-.59-.06-1.04-.14-1.5z" />
                    </svg>
                    Continuar con Google
                  </Button>
                  <button type="button" className="lovable-auth-button" onClick={() => social("lovable")}>
                    Continue with Lovable
                  </button>
                  <div className="my-2 flex items-center gap-3 text-xs font-semibold uppercase text-muted-foreground">
                    <span className="h-0.5 flex-1 bg-ink/15" /> o con email <span className="h-0.5 flex-1 bg-ink/15" />
                  </div>
                </div>
              )}

              <form onSubmit={enviar} className="mt-4 grid gap-4">
                {modo === "registro" && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="nombre">Nombre y apellido</Label>
                    <Input id="nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
                  </div>
                )}
                <div className="grid gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {modo !== "olvide" && (
                  <div className="grid gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Contraseña</Label>
                      {modo === "ingreso" && (
                        <button
                          type="button"
                          className="text-xs font-semibold text-secondary hover:underline"
                          onClick={() => setModo("olvide")}
                        >
                          ¿La olvidaste?
                        </button>
                      )}
                    </div>
                    <Input
                      id="password"
                      type="password"
                      required
                      minLength={8}
                      autoComplete={modo === "registro" ? "new-password" : "current-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    {modo === "registro" && (
                      <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
                    )}
                  </div>
                )}
                <Button type="submit" size="lg" disabled={cargando}>
                  {cargando
                    ? "Un momento…"
                    : modo === "ingreso"
                      ? "Ingresar"
                      : modo === "registro"
                        ? "Crear cuenta"
                        : "Enviar enlace"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {modo === "registro" ? "¿Ya tenés cuenta? " : modo === "ingreso" ? "¿Primera vez? " : ""}
                <button
                  type="button"
                  className="font-semibold text-secondary hover:underline"
                  onClick={() => setModo(modo === "ingreso" ? "registro" : "ingreso")}
                >
                  {modo === "ingreso" ? "Creá tu cuenta" : "Ingresar"}
                </button>
              </p>
            </>
          )}
        </div>
      </main>
      <p className="pb-6 text-center text-xs text-muted-foreground">
        <Link to="/" className="hover:underline">
          ← Volver al inicio
        </Link>
      </p>
    </div>
  );
}
