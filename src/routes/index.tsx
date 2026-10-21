import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  History,
  KanbanSquare,
  Paperclip,
  Users,
} from "lucide-react";
import heroImg from "@/assets/hero-gruplab.jpg";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/gruplab/Logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GrupLab — Trabajo en grupo, visible y justo" },
      {
        name: "description",
        content:
          "Aulas con código, grupos con tablero Kanban, puntuación docente y participación medida automáticamente.",
      },
      { property: "og:title", content: "GrupLab — Trabajo en grupo, visible y justo" },
      {
        property: "og:description",
        content: "Reemplazá WhatsApp, Drive y mails por un único espacio para los trabajos grupales.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: KanbanSquare,
    title: "Tablero Kanban por grupo",
    text: "Backlog, En progreso, Revisión y Hecho. Arrastrá tareas y todos lo ven al instante.",
    color: "bg-primary",
  },
  {
    icon: BarChart3,
    title: "Participación objetiva",
    text: "Cada acción queda registrada sola. GrupLab calcula el % de aporte de cada integrante.",
    color: "bg-secondary",
  },
  {
    icon: ClipboardCheck,
    title: "Puntuación docente",
    text: "El docente puntúa de 0 a 10 y comenta cada tarea, sin salir del tablero.",
    color: "bg-sun",
  },
  {
    icon: History,
    title: "Registro de actividad",
    text: "Una línea de tiempo con quién hizo qué y cuándo, en cada grupo de la materia.",
    color: "bg-mint",
  },
  {
    icon: Paperclip,
    title: "Archivos adjuntos",
    text: "Subí entregas, consignas y borradores directamente a cada tarea.",
    color: "bg-primary",
  },
  {
    icon: Users,
    title: "Aulas con código",
    text: "Creá una materia, compartí un código de 6 letras y los alumnos se suman solos.",
    color: "bg-secondary",
  },
];

function Landing() {
  const [logueado, setLogueado] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLogueado(!!data.session));
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          {logueado ? (
            <Button asChild variant="ink">
              <Link to="/espacios">
                Mis espacios <ArrowRight />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link to="/auth">Ingresar</Link>
              </Button>
              <Button asChild>
                <Link to="/auth" search={{ modo: "registro" }}>
                  Crear cuenta
                </Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-6 lg:grid-cols-[1.05fr_1fr] lg:pt-12">
        <div>
          <span className="brut-sm inline-flex items-center gap-2 rounded-full bg-sun px-3 py-1 text-xs font-bold uppercase tracking-wider">
            Para docentes y estudiantes
          </span>
          <h1 className="mt-5 font-display text-5xl font-extrabold leading-[0.95] sm:text-6xl lg:text-7xl">
            El trabajo en grupo,{" "}
            <span className="relative inline-block">
              <span className="relative z-10">visible</span>
              <span className="absolute inset-x-0 bottom-1 -z-0 h-4 bg-primary/70 sm:h-5" />
            </span>{" "}
            y <span className="text-secondary">justo</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            GrupLab reemplaza la mezcla de WhatsApp, Drive y mails por un único espacio donde el
            progreso se ve en tiempo real y el aporte de cada integrante queda registrado.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              {logueado ? (
                <Link to="/espacios">
                  Empezar gratis <ArrowRight />
                </Link>
              ) : (
                <Link to="/auth" search={{ modo: "registro" }}>
                  Empezar gratis <ArrowRight />
                </Link>
              )}
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#como-funciona">Cómo funciona</a>
            </Button>
          </div>
        </div>
        <div className="relative">
          <div className="brut-lift brut overflow-hidden rounded-3xl bg-card">
            <img
              src={heroImg}
              alt="Estudiantes organizando tareas en un tablero"
              width={1280}
              height={1024}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="brut absolute -bottom-5 -left-3 hidden rounded-xl bg-card px-4 py-3 sm:block">
            <p className="text-xs font-semibold text-muted-foreground">Participación del grupo</p>
            <div className="mt-2 flex h-3 w-48 overflow-hidden rounded-full border-2 border-ink">
              <span className="w-[38%] bg-primary" />
              <span className="w-[30%] bg-secondary" />
              <span className="w-[20%] bg-sun" />
              <span className="w-[12%] bg-mint" />
            </div>
          </div>
        </div>
      </section>

      <div className="border-y-2 border-ink bg-ink py-3 text-paper">
        <div className="marquee-track flex w-max gap-10 whitespace-nowrap font-display text-lg font-bold">
          {Array.from({ length: 2 }).map((_, k) => (
            <div key={k} className="flex gap-10">
              {["Aulas con código", "Kanban en vivo", "Puntuación 0–10", "Registro de actividad", "Participación %", "Adjuntos", "Tableros independientes"].map(
                (t) => (
                  <span key={t} className="flex items-center gap-10">
                    {t} <span className="text-primary">✦</span>
                  </span>
                ),
              )}
            </div>
          ))}
        </div>
      </div>

      <section id="como-funciona" className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="max-w-2xl text-4xl font-extrabold sm:text-5xl">
          Todo lo que un trabajo grupal necesita.
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <article key={f.title} className="brut brut-lift rounded-2xl bg-card p-6">
              <span className={`brut-sm grid h-11 w-11 place-items-center rounded-lg ${f.color}`}>
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-xl font-bold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="brut grid gap-8 rounded-3xl bg-secondary p-8 text-secondary-foreground sm:p-12 lg:grid-cols-3">
          {[
            ["1", "El docente crea el aula", "Recibe un código único de 6 caracteres para compartir."],
            ["2", "Los alumnos arman grupos", "Cada grupo tiene su tablero y un alumno administrador."],
            ["3", "Todo queda registrado", "Puntuaciones, avances y participación, en un solo lugar."],
          ].map(([n, t, d]) => (
            <div key={n}>
              <span className="font-display text-6xl font-extrabold text-sun">{n}</span>
              <h3 className="mt-2 text-2xl font-bold">{t}</h3>
              <p className="mt-1 opacity-85">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t-2 border-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8">
          <Logo />
          <p className="text-sm text-muted-foreground">
            Diseñado con enfoque DCU · Hecho para cursadas reales.
          </p>
        </div>
      </footer>
    </div>
  );
}
