"use client";

import { useAuth } from "@/hooks/useAuth";
import { auth } from "@/firebase/config";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="p-10 text-zinc-500 font-mono text-sm animate-pulse">
          Iniciando sistemas...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 flex flex-col items-center pt-24">
      <div className="w-full max-w-3xl space-y-6">
        
        <header className="flex justify-between items-end mb-10">
          <div>
            <h1 className="text-3xl font-light tracking-tight text-zinc-900 dark:text-zinc-100">
              Gorila <span className="font-semibold">Cockpit</span>
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Operario activo: {user?.email}
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => auth.signOut()}
            className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 text-sm"
          >
            Cerrar sesión
          </Button>
        </header>

        {/* La Omnibarra Mecánica */}
        <div className="flex gap-3 items-center shadow-sm">
          <Input 
            type="text"
            placeholder="Escribe para capturar (@entidad, //tiempo, #tag)..."
            className="h-14 text-lg bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 focus-visible:ring-zinc-500"
            autoFocus
          />
          <Button className="h-14 px-8 text-lg font-medium bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
            Capturar
          </Button>
        </div>

        <div className="pt-8 text-xs text-zinc-400 text-center font-mono">
          Modo Fricción Cero activado. Esperando input.
        </div>

      </div>
    </div>
  );
}