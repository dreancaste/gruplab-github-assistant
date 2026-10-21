import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "./Logo";
import { Avatar } from "./Avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppHeader() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: perfil } = useQuery({
    queryKey: ["mi-perfil"],
    queryFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      const id = s.session?.user.id;
      if (!id) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  async function salir() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <div className="flex items-center gap-6">
          <Logo to="/espacios" />
          <nav className="hidden sm:block">
            <Link
              to="/espacios"
              className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-muted"
              activeProps={{ className: "bg-muted" }}
            >
              Mis espacios
            </Link>
          </nav>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="hidden text-sm font-semibold sm:inline">{perfil?.nombre}</span>
            <Avatar nombre={perfil?.nombre} id={perfil?.id} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 border-2 border-ink">
            <DropdownMenuLabel>
              <p className="font-semibold">{perfil?.nombre}</p>
              <p className="truncate text-xs font-normal text-muted-foreground">{perfil?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={salir} className="cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
