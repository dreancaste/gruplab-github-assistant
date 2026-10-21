import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function Codigo({ codigo, label = "Código" }: { codigo: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(codigo);
        setOk(true);
        toast.success("Código copiado");
        setTimeout(() => setOk(false), 1500);
      }}
      className="brut-sm group inline-flex items-center gap-3 rounded-xl bg-sun px-3 py-1.5 text-left transition-transform hover:-translate-y-px"
    >
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      <span className="font-mono text-lg font-bold tracking-[0.2em]">{codigo}</span>
      {ok ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4 opacity-60 group-hover:opacity-100" />}
    </button>
  );
}
