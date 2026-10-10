"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { auth, db } from "@/firebase/config";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { parseOmnibarInput, ParsedAtom, AtomTimeSchedule, ensureAtomSchedule } from "@/lib/omnibarParser";
import { collection, addDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Entity360Inspector } from "@/components/Entity360Inspector";
import { AtomicCalendar } from "@/components/AtomicCalendar";
import { getActiveEntities } from "@/lib/graphEngine";
import {
  Zap,
  AtSign,
  Clock,
  Hash,
  Sun,
  CheckCircle2,
  Circle,
  Trash2,
  CornerDownLeft,
  X,
  Sparkles,
  LogOut,
  CreditCard,
  AlertCircle,
  CheckCircle,
  Loader2,
  CalendarDays,
  ListOrdered,
  Building2,
  Settings,
} from "lucide-react";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const { tenant, currentRole } = useTenant();
  const router = useRouter();

  // Estados de la Omnibarra
  const [inputValue, setInputValue] = useState("");
  const [atoms, setAtoms] = useState<ParsedAtom[]>([]);
  const [outdoorMode, setOutdoorMode] = useState(false);
  const [lastCaptureTime, setLastCaptureTime] = useState<number | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [inspectingEntity, setInspectingEntity] = useState<string | null>(null);
  const [dashboardView, setDashboardView] = useState<"feed" | "calendar">("feed");

  // Estados de Stripe Checkout
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutNotification, setCheckoutNotification] = useState<"success" | "cancelled" | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Redirección si no está autenticado
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Detectar retorno de pago desde Stripe (?payment=success o ?payment=cancelled)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const payment = params.get("payment");
      if (payment === "success") {
        setCheckoutNotification("success");
      } else if (payment === "cancelled") {
        setCheckoutNotification("cancelled");
      }
    }
  }, []);

  // Cargar átomos guardados en localStorage al iniciar
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("gorila_atoms");
        if (saved) {
          const parsed = JSON.parse(saved);
          const normalized: ParsedAtom[] = parsed.map((a: any) => ({
            ...a,
            schedule: ensureAtomSchedule(a),
          }));
          setAtoms(normalized);
        }
      } catch (e) {
        console.error("Error al cargar átomos locales:", e);
      }
    }
  }, []);

  // Atajo de teclado global: '/' o 'Ctrl+K' para enfocar la Omnibarra
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === "/" || (e.ctrlKey && e.key === "k") || (e.metaKey && e.key === "k")) &&
        document.activeElement !== inputRef.current
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape" && document.activeElement === inputRef.current) {
        setInputValue("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Iniciar flujo de Checkout en Stripe
  const handleCheckout = async () => {
    setIsCheckingOut(true);
    try {
      const tenantId = tenant?.id || (user?.uid ? `tenant_${user.uid}` : "tenant_default");
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          metadata: {
            tenant_id: tenantId,
            tenantId,
            userId: user?.uid || "anon",
            userEmail: user?.email || "operario@gorila.saas",
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al iniciar la sesión de Stripe");
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No se recibió la URL de redirección de Stripe.");
      }
    } catch (err: any) {
      alert(err?.message || "Error al conectar con la pasarela de Stripe");
      setIsCheckingOut(false);
    }
  };

  // Guardar en localStorage cada vez que cambien los átomos
  const persistAtoms = (newAtoms: ParsedAtom[]) => {
    setAtoms(newAtoms);
    try {
      localStorage.setItem("gorila_atoms", JSON.stringify(newAtoms));
    } catch (e) {
      console.error("Error al persistir átomos:", e);
    }
  };

  // Parser en tiempo real del input actual
  const liveParse = useMemo(() => {
    return parseOmnibarInput(inputValue);
  }, [inputValue]);

  // Entidades activas calculadas dinámicamente desde el Grafo Atómico
  const activeEntities = useMemo(() => {
    return getActiveEntities(atoms, 12);
  }, [atoms]);

  // Motor central de captura atómica (Omnibarra o Inspector 360°)
  const captureAtom = async (rawInput: string) => {
    const trimmed = rawInput.trim();
    if (!trimmed) return;

    const startTime = performance.now();
    const parsed = parseOmnibarInput(trimmed);

    const now = new Date();
    const formattedTime = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const newAtom: ParsedAtom = {
      id: `atom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      rawText: trimmed,
      cleanText: parsed.cleanText,
      entities: parsed.entities,
      times: parsed.times,
      tags: parsed.tags,
      timestamp: formattedTime,
      createdAt: Date.now(),
      completed: false,
      schedule: parsed.schedule,
    };

    // 1. Guardado optimista instantáneo en la UI (< 100ms)
    const updated = [newAtom, ...atoms];
    persistAtoms(updated);

    const duration = Math.round(performance.now() - startTime);
    setLastCaptureTime(duration);

    // 2. Sincronización asíncrona de fondo con Firestore (Soberanía del Dato: atoms/{atomId} con tenant_id)
    if (user?.uid) {
      const tenantId = tenant?.id || `tenant_${user.uid}`;
      const atomDocRef = doc(db, "atoms", newAtom.id);
      setDoc(atomDocRef, {
        id: newAtom.id,
        tenant_id: tenantId,
        authorId: user.uid,
        authorEmail: user.email || null,
        rawText: newAtom.rawText,
        cleanText: newAtom.cleanText,
        entities: newAtom.entities,
        times: newAtom.times,
        tags: newAtom.tags,
        schedule: newAtom.schedule,
        timestamp: formattedTime,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        completed: false,
      }).catch((err) => {
        console.warn("[Gorila Codex] Sincronización Firestore en segundo plano diferida:", err);
      });
    }
  };

  // Modificar la programación temporal del átomo (Fecha de registro, franja horaria, todo el día)
  const handleUpdateAtomSchedule = (atomId: string, newSchedule: AtomTimeSchedule) => {
    const updated = atoms.map((atom) =>
      atom.id === atomId
        ? {
            ...atom,
            schedule: newSchedule,
            updatedAt: Date.now(),
          }
        : atom
    );
    persistAtoms(updated);
  };

  // Ejecutar captura ultrarrápida desde la Omnibarra (< 3 segundos)
  const handleCapture = async () => {
    const textToCapture = inputValue;
    setInputValue("");
    await captureAtom(textToCapture);

    // Reenfocar la Omnibarra de inmediato para la siguiente captura
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  };

  // Alternar estado completado de un átomo
  const toggleComplete = (id: string) => {
    const updated = atoms.map((atom) =>
      atom.id === id ? { ...atom, completed: !atom.completed } : atom
    );
    persistAtoms(updated);
  };

  // Eliminar un átomo
  const deleteAtom = (id: string) => {
    const updated = atoms.filter((atom) => atom.id === id);
    persistAtoms(updated);
  };

  // Insertar modificador rápido en la Omnibarra
  const insertModifier = (prefix: string) => {
    setInputValue((prev) => {
      const space = prev.length > 0 && !prev.endsWith(" ") ? " " : "";
      return `${prev}${space}${prefix}`;
    });
    inputRef.current?.focus();
  };

  // Filtrado de átomos
  const filteredAtoms = useMemo(() => {
    return atoms.filter((atom) => {
      if (selectedTag && !atom.tags.includes(selectedTag)) return false;
      if (selectedEntity && !atom.entities.includes(selectedEntity)) return false;
      return true;
    });
  }, [atoms, selectedTag, selectedEntity]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="p-10 text-zinc-500 font-mono text-sm animate-pulse flex items-center gap-3">
          <Zap className="h-5 w-5 text-amber-500 animate-spin" />
          <span>Iniciando Cockpit Gorila...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen transition-colors duration-200 p-4 sm:p-6 md:p-10 flex flex-col items-center ${
        outdoorMode
          ? "bg-white text-black font-sans selection:bg-black selection:text-white"
          : "bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
      }`}
    >
      <div className="w-full max-w-4xl space-y-8 pt-8 md:pt-14">
        
        {/* Banner de Notificación de Retorno de Stripe */}
        {checkoutNotification === "success" && (
          <div className="p-4 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 flex items-center justify-between text-sm font-mono shadow-sm">
            <div className="flex items-center gap-2.5">
              <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                <strong>¡Pago Confirmado!</strong> La pasarela de Stripe procesó la suscripción con éxito.
              </span>
            </div>
            <button
              onClick={() => setCheckoutNotification(null)}
              className="text-emerald-600 hover:text-emerald-900 dark:hover:text-emerald-100 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {checkoutNotification === "cancelled" && (
          <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 flex items-center justify-between text-sm font-mono shadow-sm">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Proceso Cancelado:</strong> Regresaste de Stripe sin completar el pago. No se hizo ningún cargo.
              </span>
            </div>
            <button
              onClick={() => setCheckoutNotification(null)}
              className="text-amber-600 hover:text-amber-900 dark:hover:text-amber-100 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Cabecera del Cockpit */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b pb-6 border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center justify-center p-2 rounded-lg ${
                  outdoorMode
                    ? "bg-black text-white"
                    : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                }`}
              >
                <Zap className="h-5 w-5 fill-current" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-light tracking-tight">
                Gorila <span className="font-bold">Cockpit</span>
              </h1>
              {outdoorMode && (
                <span className="text-xs font-mono uppercase bg-black text-white px-2 py-0.5 font-bold tracking-wider">
                  Modo Outdoor
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-2 font-mono flex flex-wrap items-center gap-1.5">
              <span>Operario: <span className="font-medium text-zinc-700 dark:text-zinc-300">{user?.email}</span></span>
              {tenant && (
                <span className="inline-flex items-center gap-1 text-zinc-400">
                  • <Building2 className="h-3 w-3 text-zinc-500" />
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{tenant.name}</span>
                  <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono uppercase">
                    {currentRole}
                  </Badge>
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
            {/* Gestión de Empresa & Perfil */}
            <Link href="/dashboard/settings">
              <Button
                variant="outline"
                size="sm"
                className={`gap-1.5 text-xs font-mono font-semibold transition-all ${
                  outdoorMode
                    ? "bg-white text-black border-2 border-black hover:bg-zinc-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    : "border-zinc-300 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                }`}
                title="Configuración de Perfil, Empresa, Equipo y Permisos"
              >
                <Building2 className="h-3.5 w-3.5 text-blue-500" />
                <span className="hidden md:inline">{tenant?.name || "Empresa"} • </span>
                <span>Ajustes</span>
              </Button>
            </Link>

            {/* Botón Stripe Checkout */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckout}
              disabled={isCheckingOut}
              className={`gap-1.5 text-xs font-mono font-semibold transition-all ${
                outdoorMode
                  ? "bg-white text-black border-2 border-black hover:bg-zinc-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  : "border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              }`}
            >
              {isCheckingOut ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CreditCard className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              )}
              <span>{isCheckingOut ? "Conectando..." : "Suscripción Pro"}</span>
            </Button>

            {/* Toggle Modo Outdoor */}
            <Button
              variant={outdoorMode ? "default" : "outline"}
              size="sm"
              onClick={() => setOutdoorMode(!outdoorMode)}
              className={`gap-1.5 text-xs font-mono ${
                outdoorMode
                  ? "bg-black text-white hover:bg-zinc-800 border-2 border-black font-bold"
                  : "border-zinc-300 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              <Sun className="h-3.5 w-3.5 text-amber-400" />
              <span>{outdoorMode ? "Outdoor ON" : "Modo Outdoor"}</span>
            </Button>

            {/* Cerrar Sesión */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => auth.signOut()}
              className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 gap-1.5 text-xs font-mono"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </div>
        </header>

        {/* ============================================================ */}
        {/* LA OMNIBARRA MECÁNICA (FRICCIÓN CERO)                         */}
        {/* ============================================================ */}
        <section className="space-y-3">
          <div
            className={`relative rounded-xl transition-all ${
              outdoorMode
                ? "border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-white"
                : "border border-zinc-300 dark:border-zinc-800 shadow-md bg-white dark:bg-zinc-900/90 focus-within:ring-2 focus-within:ring-zinc-900 dark:focus-within:ring-zinc-400 focus-within:border-transparent"
            }`}
          >
            <div className="flex items-center p-2 sm:p-2.5 gap-2">
              <span className="pl-2 text-zinc-400">
                <Zap className={`h-5 w-5 ${inputValue ? "text-amber-500 animate-pulse" : ""}`} />
              </span>

              <Input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCapture();
                  }
                }}
                placeholder="Captura rápida: Hormigón @central //hoy #urgente..."
                className={`h-12 sm:h-14 text-base sm:text-lg border-0 shadow-none focus-visible:ring-0 px-2 font-mono bg-transparent ${
                  outdoorMode ? "text-black placeholder:text-zinc-500 font-bold" : ""
                }`}
                autoFocus
              />

              <Button
                onClick={handleCapture}
                disabled={!inputValue.trim()}
                className={`h-11 sm:h-12 px-5 sm:px-7 font-mono font-bold text-sm tracking-wide transition-transform active:scale-95 ${
                  outdoorMode
                    ? "bg-black text-white hover:bg-zinc-800 border-2 border-black"
                    : "bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                }`}
              >
                <span>Capturar</span>
                <CornerDownLeft className="h-4 w-4 ml-1.5 opacity-70" />
              </Button>
            </div>

            {/* LIVE PARSING HUD: Desglose en tiempo real */}
            {liveParse.hasTokens && (
              <div
                className={`px-4 py-2.5 border-t text-xs flex flex-wrap items-center gap-2 ${
                  outdoorMode
                    ? "border-black bg-zinc-100 text-black font-mono font-bold"
                    : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 text-zinc-600 dark:text-zinc-300"
                }`}
              >
                <span className="text-[11px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-semibold mr-1">
                  Radar en vivo:
                </span>

                {liveParse.entities.map((ent) => (
                  <Badge
                    key={ent}
                    variant="entity"
                    className="cursor-pointer hover:opacity-80 transition-opacity gap-1"
                    onClick={() => setInspectingEntity(ent)}
                    title={`Ver Contexto 360° de @${ent}`}
                  >
                    <AtSign className="h-3 w-3" />
                    <span>{ent}</span>
                  </Badge>
                ))}

                {liveParse.times.map((time) => (
                  <Badge key={time} variant="time" className="gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{time}</span>
                  </Badge>
                ))}

                {liveParse.tags.map((tag) => (
                  <Badge key={tag} variant="tag" className="gap-1">
                    <Hash className="h-3 w-3" />
                    <span>{tag}</span>
                  </Badge>
                ))}

                {liveParse.cleanText && (
                  <span className="italic ml-auto truncate max-w-xs text-zinc-500">
                    &ldquo;{liveParse.cleanText}&rdquo;
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Botones de Modificadores Rápidos & Indicador Fricción Cero */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-zinc-400 mr-1 text-[11px] hidden sm:inline">Insertar:</span>
              <button
                type="button"
                onClick={() => insertModifier("@")}
                className="px-2 py-1 rounded bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition-colors flex items-center gap-1 font-semibold"
              >
                <AtSign className="h-3 w-3" /> @Entidad
              </button>
              <button
                type="button"
                onClick={() => insertModifier("//")}
                className="px-2 py-1 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition-colors flex items-center gap-1 font-semibold"
              >
                <Clock className="h-3 w-3" /> //Tiempo
              </button>
              <button
                type="button"
                onClick={() => insertModifier("#")}
                className="px-2 py-1 rounded bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 text-sky-700 dark:text-sky-300 hover:bg-sky-100 transition-colors flex items-center gap-1 font-semibold"
              >
                <Hash className="h-3 w-3" /> #Tag
              </button>
            </div>

            <div className="flex items-center gap-3 text-zinc-400 font-mono text-[11px]">
              {lastCaptureTime !== null && (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold animate-pulse">
                  <Sparkles className="h-3 w-3" /> Capturado en {lastCaptureTime}ms
                </span>
              )}
              <span className="hidden md:inline">
                Atajo: <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">/</kbd> o <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">Ctrl+K</kbd>
              </span>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* GRAFO ATÓMICO: ENTIDADES VIVAS (FRICCIÓN CERO)               */}
        {/* ============================================================ */}
        {activeEntities.length > 0 && (
          <section
            className={`p-4 rounded-xl border transition-all ${
              outdoorMode
                ? "border-2 border-black bg-zinc-50 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40"
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider font-mono font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <AtSign className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  Grafo Vivo • Entidades Vinculadas ({activeEntities.length})
                </span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono hidden sm:inline">
                Clic para abrir el Contexto 360° de la entidad
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeEntities.map((ent) => (
                <button
                  key={ent.id}
                  type="button"
                  onClick={() => setInspectingEntity(ent.id)}
                  className={`group px-3 py-1.5 rounded-lg border text-xs font-mono transition-all flex items-center gap-2 ${
                    outdoorMode
                      ? "border-black bg-white hover:bg-black hover:text-white"
                      : "border-purple-200 dark:border-purple-800/60 bg-purple-50/70 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 shadow-xs"
                  }`}
                  title={`Abrir vista 360° de ${ent.name}`}
                >
                  <span className="font-bold">{ent.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      outdoorMode
                        ? "bg-black text-white group-hover:bg-white group-hover:text-black"
                        : "bg-purple-200/80 dark:bg-purple-900 text-purple-900 dark:text-purple-200"
                    }`}
                  >
                    {ent.atomCount}
                  </span>
                  {ent.pendingCount > 0 ? (
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" title={`${ent.pendingCount} pendientes`} />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-emerald-500" title="100% completado" />
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ============================================================ */}
        {/* NAVEGACIÓN Y VISTAS: FEED O CALENDARIO ATÓMICO               */}
        {/* ============================================================ */}
        <section className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-semibold tracking-tight">
                  {dashboardView === "feed" ? "Átomos Capturados" : "Calendario Atómico"}
                </h2>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${
                    outdoorMode
                      ? "bg-black text-white"
                      : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {atoms.length}
                </span>
              </div>

              {/* Filtros Activos en Feed */}
              {dashboardView === "feed" && (selectedTag || selectedEntity) && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-400 font-mono hidden md:inline">Filtro:</span>
                  {selectedTag && (
                    <Badge variant="tag" className="cursor-pointer gap-1" onClick={() => setSelectedTag(null)}>
                      #{selectedTag} <X className="h-3 w-3" />
                    </Badge>
                  )}
                  {selectedEntity && (
                    <Badge variant="entity" className="cursor-pointer gap-1" onClick={() => setSelectedEntity(null)}>
                      @{selectedEntity} <X className="h-3 w-3" />
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Selector de Vista: Lista vs Calendario */}
            <div
              className={`inline-flex items-center p-1 rounded-xl border self-start sm:self-auto transition-all ${
                outdoorMode
                  ? "border-2 border-black bg-zinc-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  : "border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/60"
              }`}
            >
              <button
                type="button"
                onClick={() => setDashboardView("feed")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  dashboardView === "feed"
                    ? outdoorMode
                      ? "bg-black text-white"
                      : "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                <ListOrdered className="h-3.5 w-3.5" />
                <span>Lista</span>
              </button>
              <button
                type="button"
                onClick={() => setDashboardView("calendar")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  dashboardView === "calendar"
                    ? outdoorMode
                      ? "bg-black text-white"
                      : "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                <span>Calendario</span>
              </button>
            </div>
          </div>

          {/* Renderizado de Vista: Calendario Atómico o Feed Secuencial */}
          {dashboardView === "calendar" ? (
            <AtomicCalendar
              atoms={atoms}
              outdoorMode={outdoorMode}
              onToggleComplete={toggleComplete}
              onSelectEntity={(ent) => setInspectingEntity(ent)}
              onQuickCapture={captureAtom}
              onUpdateAtomSchedule={handleUpdateAtomSchedule}
            />
          ) : (
            <>
              {filteredAtoms.length === 0 ? (
                <div
                  className={`p-12 text-center rounded-xl border-2 border-dashed ${
                    outdoorMode
                      ? "border-black text-black bg-zinc-50 font-bold"
                      : "border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600"
                  }`}
                >
                  <Zap className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-mono">
                    {atoms.length === 0
                      ? "Sin átomos registrados aún. Escribe en la Omnibarra para tu primera captura."
                      : "No hay átomos que coincidan con los filtros seleccionados."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredAtoms.map((atom) => (
                    <div
                      key={atom.id}
                      className={`group p-4 rounded-xl transition-all flex items-start gap-3.5 ${
                        outdoorMode
                          ? "border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white"
                          : "border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm"
                      } ${atom.completed ? "opacity-50" : ""}`}
                    >
                      {/* Botón de Completar */}
                      <button
                        type="button"
                        onClick={() => toggleComplete(atom.id)}
                        className="mt-0.5 text-zinc-400 hover:text-emerald-500 transition-colors"
                        title={atom.completed ? "Marcar pendiente" : "Marcar completado"}
                      >
                        {atom.completed ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <Circle className="h-5 w-5 hover:text-zinc-600 dark:hover:text-zinc-200" />
                        )}
                      </button>

                      {/* Contenido del Átomo */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <p
                          className={`text-sm sm:text-base leading-relaxed break-words font-mono ${
                            atom.completed ? "line-through text-zinc-400 dark:text-zinc-500" : ""
                          }`}
                        >
                          {atom.cleanText || atom.rawText}
                        </p>

                        {/* Metadatos en Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {atom.entities.map((ent) => (
                            <Badge
                              key={ent}
                              variant="entity"
                              className="cursor-pointer hover:opacity-80 transition-opacity gap-1"
                              onClick={() => setInspectingEntity(ent)}
                              title={`Abrir Contexto 360° de @${ent}`}
                            >
                              <AtSign className="h-3 w-3" />
                              <span>{ent}</span>
                            </Badge>
                          ))}

                          {atom.times.map((time) => (
                            <Badge key={time} variant="time" className="gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{time}</span>
                            </Badge>
                          ))}

                          {atom.schedule && (
                            <Badge
                              variant="time"
                              className="cursor-pointer hover:opacity-80 transition-opacity gap-1 font-mono text-[10px]"
                              onClick={() => setDashboardView("calendar")}
                              title={`Ver en calendario: ${atom.schedule.recordDate}`}
                            >
                              <CalendarDays className="h-3 w-3 text-blue-500" />
                              <span>
                                {atom.schedule.recordDate}
                                {!atom.schedule.isAllDay && atom.schedule.startTime
                                  ? ` • ${atom.schedule.startTime}${atom.schedule.endTime ? `-${atom.schedule.endTime}` : ""}`
                                  : " (Todo el día)"}
                              </span>
                            </Badge>
                          )}

                          {atom.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="tag"
                              className="cursor-pointer hover:opacity-80 transition-opacity gap-1"
                              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                            >
                              <Hash className="h-3 w-3" />
                              <span>{tag}</span>
                            </Badge>
                          ))}

                          <span className="text-[10px] text-zinc-400 font-mono ml-auto">
                            {atom.timestamp}
                          </span>
                        </div>
                      </div>

                      {/* Botón Eliminar */}
                      <button
                        type="button"
                        onClick={() => deleteAtom(atom.id)}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-zinc-400 hover:text-rose-500 transition-all"
                        title="Eliminar átomo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* ============================================================ */}
        {/* INSPECTOR 360° DE LA ENTIDAD (EL GRAFO ATÓMICO DEL CODEX)    */}
        {/* ============================================================ */}
        <Entity360Inspector
          isOpen={!!inspectingEntity}
          entityKey={inspectingEntity}
          atoms={atoms}
          outdoorMode={outdoorMode}
          onClose={() => setInspectingEntity(null)}
          onToggleComplete={toggleComplete}
          onDeleteAtom={deleteAtom}
          onCaptureForEntity={captureAtom}
          onSelectEntity={(nextKey) => setInspectingEntity(nextKey)}
        />

      </div>
    </div>
  );
}