"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { TenantRole } from "@/types/tenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TeamManagement } from "@/components/TeamManagement";
import {
  ArrowLeft,
  Building2,
  Users,
  ShieldCheck,
  User as UserIcon,
  Crown,
  Shield,
  Zap,
  Eye,
  Mail,
  Phone,
  MapPin,
  FileText,
  CreditCard,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sun,
  Lock,
  Sparkles,
  Loader2,
  LogOut,
  ExternalLink,
  Receipt,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { auth } from "@/firebase/config";

type ActiveTab = "profile" | "company" | "team" | "permissions" | "billing";

export default function ClientSettingsDashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const {
    userProfile,
    tenant,
    members,
    currentRole,
    isOwner,
    isAdmin,
    loading: tenantLoading,
    error: tenantError,
    bootstrapTenant,
    updateTenant,
    updateUserProfile,
  } = useTenant();

  const [activeTab, setActiveTab] = useState<ActiveTab>("profile");
  const [outdoorMode, setOutdoorMode] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Formulario Mi Perfil
  const [displayName, setDisplayName] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Formulario Empresa
  const [companyName, setCompanyName] = useState("");
  const [cif, setCif] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isSavingCompany, setIsSavingCompany] = useState(false);

  // Estados de FinOps & Stripe (Módulo de Expansión & Portal)
  const [seatQuantity, setSeatQuantity] = useState<number>(1);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);


  // Inicializar estados locales cuando los datos carguen
  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || "");
    }
  }, [userProfile]);

  useEffect(() => {
    if (tenant) {
      setCompanyName(tenant.name || "");
      setCif(tenant.cif || "");
      setCompanyEmail(tenant.email || "");
      setPhone(tenant.phone || "");
      setAddress(tenant.address || "");
    }
  }, [tenant]);

  // Cargar preferencia de Outdoor Mode guardada
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedOutdoor = localStorage.getItem("gorila_outdoor_mode");
      if (savedOutdoor === "true") {
        setOutdoorMode(true);
      }
    }
  }, []);

  const toggleOutdoorMode = () => {
    const nextVal = !outdoorMode;
    setOutdoorMode(nextVal);
    if (typeof window !== "undefined") {
      localStorage.setItem("gorila_outdoor_mode", String(nextVal));
    }
  };

  const showToast = (type: "success" | "error", text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage(null);
    }, 4000);
  };

  // Guardar datos de perfil
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    setIsSavingProfile(true);
    try {
      await updateUserProfile({ displayName: displayName.trim() });
      showToast("success", "Perfil actualizado con éxito");
    } catch (err: any) {
      showToast("error", err?.message || "Error al actualizar perfil");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Guardar datos de la empresa (o bootstrap si no existe)
  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      showToast("error", "El nombre de la empresa es obligatorio");
      return;
    }

    setIsSavingCompany(true);
    try {
      if (!tenant || tenant.id.startsWith("tenant_") && !tenant.updatedAt && !tenant.cif && !tenant.phone) {
        // Ejecutar bootstrap si es la primera vez
        await bootstrapTenant(companyName, cif);
      } else {
        await updateTenant({
          name: companyName.trim(),
          cif: cif.trim(),
          email: companyEmail.trim(),
          phone: phone.trim(),
          address: address.trim(),
        });
      }
      showToast("success", "Datos de la empresa guardados correctamente");
    } catch (err: any) {
      showToast("error", err?.message || "Error al guardar datos de la empresa");
    } finally {
      setIsSavingCompany(false);
    }
  };

  // ============================================================
  // FINOPS: MÓDULO DE EXPANSIÓN (AÑADIR USUARIOS - 10€/MES)
  // ============================================================
  const handleAddSeatCheckout = async (quantity: number = 1) => {
    if (!tenant?.id) {
      showToast("error", "No se detectó el identificador del espacio de trabajo");
      return;
    }
    setIsCheckingOut(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_seat",
          priceId: "price_1UP8klLDAGQuuEjm755xMMmm",
          additionalSeats: quantity,
          tenantId: tenant.id,
          userId: user?.uid,
          userEmail: user?.email,
          customerId:
            tenant.stripeCustomerId ||
            tenant.stripe_customer_id ||
            tenant.subscription?.stripeCustomerId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        showToast("error", data.error || "No se pudo iniciar el proceso de checkout");
      }
    } catch (err: any) {
      showToast("error", err?.message || "Error al conectar con la pasarela de pago");
    } finally {
      setIsCheckingOut(false);
    }
  };

  // ============================================================
  // FINOPS: CONTRATAR PLAN BASE PRO (29€/MES)
  // ============================================================
  const handleSubscribePro = async () => {
    if (!tenant?.id) {
      showToast("error", "No se detectó el identificador del espacio de trabajo");
      return;
    }
    setIsCheckingOut(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          userId: user?.uid,
          userEmail: user?.email,
          customerId:
            tenant.stripeCustomerId ||
            tenant.stripe_customer_id ||
            tenant.subscription?.stripeCustomerId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        showToast("error", data.error || "No se pudo iniciar el proceso de suscripción Pro");
      }
    } catch (err: any) {
      showToast("error", err?.message || "Error al conectar con Stripe");
    } finally {
      setIsCheckingOut(false);
    }
  };

  // ============================================================
  // FINOPS: ACCESO AL PORTAL DEL CLIENTE DE STRIPE
  // ============================================================
  const handleOpenPortal = async () => {
    if (!tenant?.id) {
      showToast("error", "No se detectó el identificador del espacio de trabajo");
      return;
    }

    const customerId =
      tenant.stripeCustomerId ||
      tenant.stripe_customer_id ||
      tenant.subscription?.stripeCustomerId;

    if (!customerId) {
      showToast(
        "error",
        "Aún no hay cuenta de facturación en Stripe. Activa el Plan Pro o añade un usuario para inicializarla."
      );
      return;
    }

    setIsOpeningPortal(true);
    try {
      const res = await fetch("/api/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          customerId,
          returnUrl: window.location.href,
        }),
      });

      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        showToast("error", data.error || "No se pudo abrir el portal de facturación");
      }
    } catch (err: any) {
      showToast("error", err?.message || "Error al conectar con el portal de Stripe");
    } finally {
      setIsOpeningPortal(false);
    }
  };



  if (authLoading || tenantLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center font-mono">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500 mb-3" />
        <p className="text-sm text-zinc-500">Sincronizando portal de gestión del cliente...</p>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen transition-colors duration-150 ${
        outdoorMode
          ? "bg-zinc-100 text-black selection:bg-black selection:text-white"
          : "bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Notificación Toast flotante */}
        {statusMessage && (
          <div
            className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border flex items-center gap-2.5 font-mono text-xs transition-all ${
              statusMessage.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800"
                : "bg-rose-50 dark:bg-rose-950/90 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-500" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* ============================================================ */}
        {/* BARRA SUPERIOR: RETORNO AL COCKPIT Y MODO OUTDOOR           */}
        {/* ============================================================ */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6 border-zinc-200 dark:border-zinc-800">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button
                  variant="outline"
                  size="sm"
                  className={`gap-1.5 font-mono text-xs font-semibold ${
                    outdoorMode
                      ? "border-2 border-black bg-white hover:bg-black hover:text-white"
                      : "border-zinc-300 dark:border-zinc-800"
                  }`}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Volver al Cockpit</span>
                </Button>
              </Link>

              <span className="text-zinc-400 font-mono text-sm hidden sm:inline">/</span>

              <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
                <Building2 className="h-6 w-6 text-zinc-700 dark:text-zinc-300" />
                <span>Gestión de Empresa y Perfil</span>
              </h1>
            </div>

            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-mono">
              Organización: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{tenant?.name || "Mi Organización"}</span> • Tu Rol:{" "}
              <span className="capitalize font-semibold text-zinc-800 dark:text-zinc-200">{currentRole}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Toggle Outdoor Mode */}
            <Button
              variant={outdoorMode ? "default" : "outline"}
              size="sm"
              onClick={toggleOutdoorMode}
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
        {/* NAVEGACIÓN POR PESTAÑAS (FRICCIÓN CERO)                     */}
        {/* ============================================================ */}
        <div
          className={`flex overflow-x-auto p-1.5 rounded-xl border gap-1 font-mono text-xs ${
            outdoorMode
              ? "border-2 border-black bg-zinc-200"
              : "border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/60"
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
              activeTab === "profile"
                ? outdoorMode
                  ? "bg-black text-white font-bold"
                  : "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <UserIcon className="h-4 w-4" />
            <span>Mi Perfil</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("company")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
              activeTab === "company"
                ? outdoorMode
                  ? "bg-black text-white font-bold"
                  : "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>Configuración de Empresa</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("team")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
              activeTab === "team"
                ? outdoorMode
                  ? "bg-black text-white font-bold"
                  : "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Equipo e Invitaciones ({members.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("permissions")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
              activeTab === "permissions"
                ? outdoorMode
                  ? "bg-black text-white font-bold"
                  : "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Matriz de Permisos (RBAC)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("billing")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
              activeTab === "billing"
                ? outdoorMode
                  ? "bg-black text-white font-bold"
                  : "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <CreditCard className="h-4 w-4" />
            <span>Facturación (FinOps)</span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* PESTAÑA 1: MI PERFIL                                         */}
        {/* ============================================================ */}
        {activeTab === "profile" && (
          <section className="space-y-6">
            <div
              className={`p-6 rounded-2xl border transition-all ${
                outdoorMode
                  ? "border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm"
              }`}
            >
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-zinc-200 dark:border-zinc-800">
                <div
                  className={`h-16 w-16 rounded-2xl flex items-center justify-center text-xl font-bold font-mono ${
                    outdoorMode
                      ? "bg-black text-white"
                      : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                  }`}
                >
                  {user?.email?.charAt(0).toUpperCase() || "O"}
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight">
                    {userProfile?.displayName || user?.email?.split("@")[0] || "Operario"}
                  </h2>
                  <p className="text-xs text-zinc-500 font-mono">{user?.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="default" className="text-[10px] font-mono">
                      UID: {user?.uid.substring(0, 12)}...
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono border-emerald-500 text-emerald-600 dark:text-emerald-400"
                    >
                      {userProfile?.role || "Free Tier"}
                    </Badge>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Nombre Completo o Alias de Operario
                  </label>
                  <Input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ej. Sergio Ramírez"
                    className={`font-mono ${outdoorMode ? "border-2 border-black" : ""}`}
                    required
                  />
                  <p className="text-[11px] text-zinc-400 font-mono mt-1">
                    Este nombre identificará tus capturas y firmas de átomos en el Grafo Atómico.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Correo Electrónico (Firebase Auth)
                  </label>
                  <Input
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className={`font-mono opacity-70 bg-zinc-100 dark:bg-zinc-800 ${
                      outdoorMode ? "border-2 border-black" : ""
                    }`}
                  />
                  <p className="text-[11px] text-zinc-400 font-mono mt-1">
                    El correo principal es gestionado soberanamente por Firebase Auth.
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSavingProfile}
                    className={`gap-2 font-mono font-bold text-xs ${
                      outdoorMode
                        ? "bg-black text-white hover:bg-zinc-800 border-2 border-black"
                        : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    }`}
                  >
                    {isSavingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    <span>Guardar Cambios de Perfil</span>
                  </Button>
                </div>
              </form>
            </div>

            {/* Atajos del Codex para Operarios */}
            <div
              className={`p-6 rounded-2xl border transition-all ${
                outdoorMode
                  ? "border-2 border-black bg-white"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60"
              }`}
            >
              <h3 className="text-sm font-bold font-mono tracking-tight mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span>Atajos Rápidos de Operación en Campo (Codex Gorila)</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between">
                  <span>Enfocar Omnibarra</span>
                  <kbd className="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-700 font-bold">/ o Ctrl+K</kbd>
                </div>
                <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between">
                  <span>Guardar Átomo instantáneo</span>
                  <kbd className="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-700 font-bold">Enter</kbd>
                </div>
                <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between">
                  <span>Vincular Entidad</span>
                  <kbd className="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-700 font-bold">@entidad</kbd>
                </div>
                <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between">
                  <span>Asignar Fecha / Horario</span>
                  <kbd className="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-700 font-bold">//hoy //10:00</kbd>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ============================================================ */}
        {/* PESTAÑA 2: CONFIGURACIÓN DE EMPRESA                          */}
        {/* ============================================================ */}
        {activeTab === "company" && (
          <section className="space-y-6">
            <div
              className={`p-6 rounded-2xl border transition-all ${
                outdoorMode
                  ? "border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-zinc-200 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                    <span>Datos de la Organización / Empresa</span>
                  </h2>
                  <p className="text-xs text-zinc-500 font-mono mt-1">
                    Aislamiento Multi-Tenant soberano: ID del Workspace <code className="font-bold">{tenant?.id}</code>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-emerald-500 text-emerald-600 dark:text-emerald-400 font-mono text-xs px-2.5 py-1"
                  >
                    Plan: {tenant?.plan || "Free"}
                  </Badge>
                  {isOwner && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActiveTab("billing")}
                      className={`gap-1.5 text-xs font-mono ${
                        outdoorMode
                          ? "border-2 border-black bg-white hover:bg-black hover:text-white"
                          : "border-zinc-300 dark:border-zinc-700"
                      }`}
                    >
                      <CreditCard className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Gestionar con Stripe</span>
                    </Button>
                  )}
                </div>
              </div>

              {!isAdmin && (
                <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs font-mono text-amber-800 dark:text-amber-200 flex items-center gap-2.5">
                  <Lock className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    Solo los usuarios con rol de <strong>Propietario</strong> o <strong>Administrador</strong> tienen privilegios para modificar los datos corporativos.
                  </span>
                </div>
              )}

              <form onSubmit={handleSaveCompany} className="space-y-4 max-w-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Razón Social o Nombre de Empresa *
                    </label>
                    <Input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Ej. Construcciones y Obras Gorila S.L."
                      disabled={!isAdmin}
                      className={`font-mono ${outdoorMode ? "border-2 border-black" : ""}`}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      CIF / NIF / Identificador Fiscal
                    </label>
                    <Input
                      type="text"
                      value={cif}
                      onChange={(e) => setCif(e.target.value)}
                      placeholder="Ej. B-12345678"
                      disabled={!isAdmin}
                      className={`font-mono ${outdoorMode ? "border-2 border-black" : ""}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-zinc-400" />
                      <span>Email Corporativo</span>
                    </label>
                    <Input
                      type="email"
                      value={companyEmail}
                      onChange={(e) => setCompanyEmail(e.target.value)}
                      placeholder="contacto@empresa.com"
                      disabled={!isAdmin}
                      className={`font-mono ${outdoorMode ? "border-2 border-black" : ""}`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-zinc-400" />
                      <span>Teléfono de Contacto</span>
                    </label>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+34 912 345 678"
                      disabled={!isAdmin}
                      className={`font-mono ${outdoorMode ? "border-2 border-black" : ""}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Dirección Fiscal / Centro Operativo</span>
                  </label>
                  <Input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Polígono Industrial Central, Nave 4"
                    disabled={!isAdmin}
                    className={`font-mono ${outdoorMode ? "border-2 border-black" : ""}`}
                  />
                </div>

                {isAdmin && (
                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={isSavingCompany}
                      className={`gap-2 font-mono font-bold text-xs ${
                        outdoorMode
                          ? "bg-black text-white hover:bg-zinc-800 border-2 border-black"
                          : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      }`}
                    >
                      {isSavingCompany ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      <span>Guardar Configuración de Empresa</span>
                    </Button>
                  </div>
                )}
              </form>
            </div>
          </section>
        )}

        {/* ============================================================ */}
        {/* PESTAÑA 3: EQUIPO E INVITACIONES                            */}
        {/* ============================================================ */}
        {activeTab === "team" && (
          <TeamManagement
            outdoorMode={outdoorMode}
            onToast={showToast}
            onOpenBilling={() => setActiveTab("billing")}
          />
        )}

        {/* ============================================================ */}
        {/* PESTAÑA 4: MATRIZ DE PERMISOS (RBAC DEL CODEX)              */}
        {/* ============================================================ */}
        {activeTab === "permissions" && (
          <section className="space-y-6">
            <div
              className={`p-6 rounded-2xl border transition-all ${
                outdoorMode
                  ? "border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm"
              }`}
            >
              <div className="mb-6">
                <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  <span>Matriz de Roles y Soberanía de Datos (RBAC Gorila)</span>
                </h2>
                <p className="text-xs text-zinc-500 font-mono mt-1">
                  Aislamiento criptográfico y reglas estrictas de Firestore ejecutadas en el nodo servidor.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr
                      className={`border-b ${
                        outdoorMode
                          ? "border-2 border-black bg-zinc-200"
                          : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50"
                      }`}
                    >
                      <th className="p-3 font-bold">Privilegio / Operación</th>
                      <th className="p-3 font-bold text-center">👑 Propietario</th>
                      <th className="p-3 font-bold text-center">🛡️ Administrador</th>
                      <th className="p-3 font-bold text-center">⚡ Operario</th>
                      <th className="p-3 font-bold text-center">👁️ Visualizador</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    <tr>
                      <td className="p-3 font-medium">Facturación Stripe y cancelación</td>
                      <td className="p-3 text-center text-emerald-500 font-bold">✓</td>
                      <td className="p-3 text-center text-zinc-400">✗</td>
                      <td className="p-3 text-center text-zinc-400">✗</td>
                      <td className="p-3 text-center text-zinc-400">✗</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium">Eliminar Organización entera</td>
                      <td className="p-3 text-center text-emerald-500 font-bold">✓</td>
                      <td className="p-3 text-center text-zinc-400">✗</td>
                      <td className="p-3 text-center text-zinc-400">✗</td>
                      <td className="p-3 text-center text-zinc-400">✗</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium">Modificar datos corporativos (CIF, Razón Social)</td>
                      <td className="p-3 text-center text-emerald-500 font-bold">✓</td>
                      <td className="p-3 text-center text-emerald-500 font-bold">✓</td>
                      <td className="p-3 text-center text-zinc-400">✗</td>
                      <td className="p-3 text-center text-zinc-400">✗</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium">Invitar y gestionar miembros de equipo</td>
                      <td className="p-3 text-center text-emerald-500 font-bold">✓</td>
                      <td className="p-3 text-center text-emerald-500 font-bold">✓</td>
                      <td className="p-3 text-center text-zinc-400">✗</td>
                      <td className="p-3 text-center text-zinc-400">✗</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium">Captura Atómica en Omnibarra (&lt; 3 seg)</td>
                      <td className="p-3 text-center text-emerald-500 font-bold">✓</td>
                      <td className="p-3 text-center text-emerald-500 font-bold">✓</td>
                      <td className="p-3 text-center text-emerald-500 font-bold">✓</td>
                      <td className="p-3 text-center text-zinc-400">✗</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium">Crear @Entidades y Subcontratistas</td>
                      <td className="p-3 text-center text-emerald-500 font-bold">✓</td>
                      <td className="p-3 text-center text-emerald-500 font-bold">✓</td>
                      <td className="p-3 text-center text-emerald-500 font-bold">✓</td>
                      <td className="p-3 text-center text-zinc-400">✗</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium">Completar tareas y editar átomos propios</td>
                      <td className="p-3 text-center text-emerald-500 font-bold">✓</td>
                      <td className="p-3 text-center text-emerald-500 font-bold">✓</td>
                      <td className="p-3 text-center text-emerald-500 font-bold">✓</td>
                      <td className="p-3 text-center text-zinc-400">✗</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium">Eliminar átomos compartidos del equipo</td>
                      <td className="p-3 text-center text-emerald-500 font-bold">✓</td>
                      <td className="p-3 text-center text-emerald-500 font-bold">✓</td>
                      <td className="p-3 text-center text-zinc-400">✗</td>
                      <td className="p-3 text-center text-zinc-400">✗</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium">Explorar Grafo Atómico 360° y Calendario</td>
                      <td className="p-3 text-center text-emerald-500 font-bold">✓</td>
                      <td className="p-3 text-center text-emerald-500 font-bold">✓</td>
                      <td className="p-3 text-center text-emerald-500 font-bold">✓</td>
                      <td className="p-3 text-center text-emerald-500 font-bold">✓</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ============================================================ */}
        {/* PESTAÑA 5: FACTURACIÓN & SUSCRIPCIÓN (FINOPS)              */}
        {/* ============================================================ */}
        {activeTab === "billing" && (
          <section className="space-y-6">
            {/* 1. ESTADO FINOPS SOBERANO */}
            <div
              className={`p-6 rounded-2xl border transition-all ${
                outdoorMode
                  ? "border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-emerald-500" />
                    <span>Control de Facturación y Suscripción (FinOps)</span>
                  </h2>
                  <p className="text-xs text-zinc-500 font-mono mt-1">
                    Soberanía del Dato: Pagos e identidades fiscales delegadas a Stripe bajo client_reference_id{" "}
                    <code className="font-bold">{tenant?.id}</code>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`font-mono text-xs px-2.5 py-1 ${
                      tenant?.subscription?.status === "active"
                        ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                        : tenant?.subscription?.status === "past_due"
                        ? "border-amber-500 text-amber-600 bg-amber-50"
                        : "border-zinc-400 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    Estado:{" "}
                    {tenant?.subscription?.status === "active"
                      ? "ACTIVA"
                      : tenant?.subscription?.status === "past_due"
                      ? "PAGO PENDIENTE"
                      : tenant?.subscription?.status === "trialing"
                      ? "PRUEBA"
                      : "FREE TIER"}
                  </Badge>
                </div>
              </div>

              {/* Grid de Métricas de Facturación */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                {/* Métrica 1: Plan */}
                <div
                  className={`p-4 rounded-xl border ${
                    outdoorMode
                      ? "border-2 border-black bg-zinc-50"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40"
                  }`}
                >
                  <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                    Plan Contratado
                  </span>
                  <div className="text-base font-bold font-mono text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Crown className="h-4 w-4 text-amber-500" />
                    <span>{tenant?.subscription?.planName || tenant?.plan || "Gorila Free Tier"}</span>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-mono mt-1 block">
                    {tenant?.subscription?.priceAmount
                      ? `${(tenant.subscription.priceAmount / 100).toFixed(2)} €/mes base`
                      : "0,00 € / mes"}
                  </span>
                </div>

                {/* Métrica 2: Asientos */}
                <div
                  className={`p-4 rounded-xl border ${
                    outdoorMode
                      ? "border-2 border-black bg-zinc-50"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40"
                  }`}
                >
                  <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                    Capacidad de Asientos
                  </span>
                  <div className="text-base font-bold font-mono text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-blue-500" />
                    <span>
                      {members.length} / {1 + (tenant?.subscription?.additionalSeats || 0)} Ocupados
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-mono mt-1 block">
                    1 base + {tenant?.subscription?.additionalSeats || 0} adicionales
                  </span>
                </div>

                {/* Métrica 3: Ciclo de Renovación */}
                <div
                  className={`p-4 rounded-xl border ${
                    outdoorMode
                      ? "border-2 border-black bg-zinc-50"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40"
                  }`}
                >
                  <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                    Próxima Renovación
                  </span>
                  <div className="text-base font-bold font-mono text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Receipt className="h-4 w-4 text-emerald-500" />
                    <span>
                      {tenant?.subscription?.currentPeriodEnd
                        ? new Date(tenant.subscription.currentPeriodEnd * 1000).toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "Sin ciclo activo"}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-mono mt-1 block">
                    {tenant?.subscription?.status === "active" ? "Renovación automática" : "Facturación inactiva"}
                  </span>
                </div>

                {/* Métrica 4: Customer ID Stripe */}
                <div
                  className={`p-4 rounded-xl border ${
                    outdoorMode
                      ? "border-2 border-black bg-zinc-50"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40"
                  }`}
                >
                  <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                    ID Cliente Stripe
                  </span>
                  <div className="text-xs font-bold font-mono text-zinc-700 dark:text-zinc-300 truncate" title={tenant?.stripeCustomerId || tenant?.subscription?.stripeCustomerId || "No asignado"}>
                    {tenant?.stripeCustomerId || tenant?.subscription?.stripeCustomerId || "No asignado"}
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono mt-1 block">
                    Firma: whsec validada
                  </span>
                </div>
              </div>
            </div>

            {/* 2. MÓDULO DE EXPANSIÓN (AÑADIR USUARIOS - 10,00 €/MES) */}
            <div
              className={`p-6 rounded-2xl border transition-all ${
                outdoorMode
                  ? "border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-200 dark:border-zinc-800">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-base font-bold tracking-tight">Módulo de Expansión: Añadir Usuarios</h3>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    Incrementa la capacidad de tu equipo en obra. Cada asiento adicional permite invitar a un nuevo operario o administrador con acceso ilimitado al Cockpit.
                  </p>
                  <div className="pt-2 flex items-center gap-3">
                    <Badge variant="outline" className="font-mono text-xs border-emerald-500 text-emerald-600 dark:text-emerald-400">
                      10,00 € / mes por usuario
                    </Badge>
                    <span className="text-xs font-mono text-zinc-400">
                      ID: price_1UP8klLDAGQuuEjm755xMMmm
                    </span>
                  </div>
                </div>

                {/* Controles táctiles del Módulo de Expansión */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  {/* Selector Táctil Stepper (>= 48px) */}
                  <div className="flex items-center justify-center border-2 border-black rounded-xl overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => setSeatQuantity((prev) => Math.max(1, prev - 1))}
                      disabled={seatQuantity <= 1 || isCheckingOut}
                      className="w-12 h-12 flex items-center justify-center font-bold text-lg hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-white transition-colors"
                      aria-label="Restar un usuario"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <div className="w-14 h-12 flex items-center justify-center font-mono font-bold text-base border-x-2 border-black bg-zinc-50">
                      {seatQuantity}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSeatQuantity((prev) => Math.min(50, prev + 1))}
                      disabled={isCheckingOut}
                      className="w-12 h-12 flex items-center justify-center font-bold text-lg hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-white transition-colors"
                      aria-label="Sumar un usuario"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Botón Táctil de Compra (Modo Outdoor: Alto Contraste, min-h-[48px]) */}
                  <Button
                    type="button"
                    onClick={() => handleAddSeatCheckout(seatQuantity)}
                    disabled={isCheckingOut || !isAdmin}
                    className={`min-h-[48px] px-6 font-mono font-bold text-xs tracking-wider transition-all ${
                      outdoorMode
                        ? "bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px]"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-95"
                    }`}
                  >
                    {isCheckingOut ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span>Conectando con Stripe...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        <span>
                          Añadir {seatQuantity} Usuario{seatQuantity > 1 ? "s" : ""} (+{(seatQuantity * 10).toFixed(2)} €/mes)
                        </span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="pt-4 flex flex-wrap items-center gap-2 text-xs font-mono text-zinc-500">
                <span>Acceso rápido:</span>
                <button
                  type="button"
                  onClick={() => setSeatQuantity(1)}
                  className={`px-3 py-1 rounded-lg border text-xs font-mono font-bold ${
                    seatQuantity === 1
                      ? outdoorMode
                        ? "bg-black text-white border-black"
                        : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  +1 Usuario (10 €/m)
                </button>
                <button
                  type="button"
                  onClick={() => setSeatQuantity(2)}
                  className={`px-3 py-1 rounded-lg border text-xs font-mono font-bold ${
                    seatQuantity === 2
                      ? outdoorMode
                        ? "bg-black text-white border-black"
                        : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  +2 Usuarios (20 €/m)
                </button>
                <button
                  type="button"
                  onClick={() => setSeatQuantity(5)}
                  className={`px-3 py-1 rounded-lg border text-xs font-mono font-bold ${
                    seatQuantity === 5
                      ? outdoorMode
                        ? "bg-black text-white border-black"
                        : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  +5 Usuarios (50 €/m)
                </button>
              </div>
            </div>

            {/* 3. ACCESO FINOPS: PORTAL DEL CLIENTE DE STRIPE */}
            <div
              className={`p-6 rounded-2xl border transition-all ${
                outdoorMode
                  ? "border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-zinc-700 dark:text-zinc-300" />
                    <h3 className="text-base font-bold tracking-tight">Portal de Clientes de Stripe</h3>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    Ley de la Fricción Cero: Gestiona tus métodos de pago, actualiza tus tarjetas corporativas y descarga facturas fiscales oficiales en PDF directamente en la interfaz certificada de Stripe, sin intermediarios ni almacenamiento de tarjetas en nuestra base de datos.
                  </p>
                  <p className="text-[11px] text-zinc-400 font-mono pt-1">
                    * Solo los Propietarios de la organización tienen autorización para acceder a la facturación corporativa.
                  </p>
                </div>

                <div>
                  <Button
                    type="button"
                    onClick={handleOpenPortal}
                    disabled={isOpeningPortal || !isOwner}
                    className={`min-h-[48px] px-6 font-mono font-bold text-xs tracking-wider transition-all w-full sm:w-auto ${
                      outdoorMode
                        ? "border-2 border-black bg-white text-black hover:bg-black hover:text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px]"
                        : "border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 shadow-sm"
                    }`}
                  >
                    {isOpeningPortal ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span>Abriendo Portal Stripe...</span>
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-4 w-4 mr-2 text-emerald-500" />
                        <span>Gestionar Facturación en Stripe</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* 4. PLAN PRO (SI ESTÁ EN FREE TIER) */}
            {(!tenant?.subscription || tenant.subscription.status !== "active") && (
              <div
                className={`p-6 rounded-2xl border transition-all ${
                  outdoorMode
                    ? "border-2 border-black bg-amber-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black"
                    : "border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 text-zinc-900 dark:text-zinc-100"
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      <h3 className="text-base font-bold tracking-tight">Activar Suscripción Base Pro</h3>
                    </div>
                    <p className="text-xs font-mono text-zinc-700 dark:text-zinc-300">
                      Desbloquea el rendimiento completo del Gorila Codex: capturas instantáneas en Omnibarra, sincronización de Cloud Tasks con rate limiting, histórico ilimitado de átomos y auditorías de obra.
                    </p>
                    <span className="inline-block text-xs font-mono font-bold text-amber-700 dark:text-amber-400 pt-1">
                      29,00 € / mes · Facturación periódica de Stripe
                    </span>
                  </div>

                  <div>
                    <Button
                      type="button"
                      onClick={handleSubscribePro}
                      disabled={isCheckingOut || !isOwner}
                      className={`min-h-[48px] px-6 font-mono font-bold text-xs tracking-wider transition-all w-full sm:w-auto ${
                        outdoorMode
                          ? "bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px]"
                          : "bg-amber-600 hover:bg-amber-700 text-white shadow-md"
                      }`}
                    >
                      {isCheckingOut ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          <span>Procesando...</span>
                        </>
                      ) : (
                        <>
                          <Crown className="h-4 w-4 mr-2" />
                          <span>Suscribir Plan Pro (29 €/m)</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
