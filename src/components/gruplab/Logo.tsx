import { Link } from "@tanstack/react-router";

export function Logo({ to = "/" }: { to?: "/" | "/espacios" }) {
  return (
    <Link to={to} className="group flex items-center gap-2">
      <span className="brut-sm grid h-9 w-9 place-items-center rounded-lg bg-primary font-display text-lg font-extrabold text-primary-foreground transition-transform group-hover:-rotate-6">
        G
      </span>
      <span className="font-display text-xl font-extrabold tracking-tight">
        Grup<span className="text-secondary">Lab</span>
      </span>
    </Link>
  );
}
