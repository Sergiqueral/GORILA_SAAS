"use client";

import Link from "next/link";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { Crown, ArrowLeft } from "lucide-react";

export function ImpersonationBanner() {
  const { isImpersonating, tenant, exitImpersonation, isSuperAdmin } = useTenant();

  if (!isImpersonating || !tenant) return null;

  return (
    <div className="w-full bg-amber-400 text-black border-b-2 border-black px-4 py-2.5 font-mono text-xs flex flex-wrap items-center justify-between gap-3 shadow-md">
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 shrink-0 fill-current" />
        <span>
          <strong>MODO SOPORTE / AUDITORÍA ACTIVO:</strong> Viendo el espacio{" "}
          <strong className="underline">{tenant.name}</strong> (<code>{tenant.id}</code>){" "}
          {isSuperAdmin ? "con permisos de SuperAdmin (God Mode)" : ""}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {isSuperAdmin && (
          <Link href="/admin">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs font-mono font-bold bg-white text-black border border-black hover:bg-zinc-100"
            >
              Backoffice Admin
            </Button>
          </Link>
        )}
        <Button
          size="sm"
          onClick={exitImpersonation}
          className="h-7 px-3 text-xs font-mono font-bold bg-black text-white hover:bg-zinc-800 border border-black"
        >
          <ArrowLeft className="h-3 w-3 mr-1" />
          Volver a mi Espacio
        </Button>
      </div>
    </div>
  );
}
