import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/gruplab/Logo";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nueva contraseña — GrupLab" },
      { name: "description", content: "Elegí una nueva contraseña para tu cuenta de GrupLab." },
      { property: "og:title", content: "Nueva contraseña — GrupLab" },
      { property: "og:description", content: "Elegí una nueva contraseña para tu cuenta de GrupLab." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    const { error } = await supabase.auth.updateUser({ password });
    setCargando(false);
    if (error) {
      toast.error("El enlace venció o no es válido. Pedí uno nuevo.");
      return;
    }
    toast.success("¡Listo! Tu contraseña fue actualizada.");
    navigate({ to: "/espacios", replace: true });
  }

  return (
    <div className="dot-grid flex min-h-screen flex-col bg-background">
      <header className="mx-auto w-full max-w-6xl px-5 py-5">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <form onSubmit={guardar} className="brut grid w-full max-w-md gap-4 rounded-3xl bg-card p-8">
          <h1 className="text-3xl font-extrabold">Elegí una contraseña nueva</h1>
          <div className="grid gap-1.5">
            <Label htmlFor="pw">Nueva contraseña</Label>
            <Input
              id="pw"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" size="lg" disabled={cargando}>
            {cargando ? "Guardando…" : "Guardar contraseña"}
          </Button>
        </form>
      </main>
    </div>
  );
}
