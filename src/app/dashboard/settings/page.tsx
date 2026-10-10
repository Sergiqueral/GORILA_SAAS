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
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sun,
  Lock,
  Sparkles,
  Loader2,
  LogOut,
  ExternalLink,
} from "lucide-react";
import { auth } from "@/firebase/config";

type ActiveTab = "profile" | "company" | "team" | "permissions";

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
    inviteMember,
    updateMemberRole,
    removeMember,
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

  // Formulario Invitación de Miembro
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TenantRole>("operator");
  const [inviteName, setInviteName] = useState("");
  const [isInviting, setIsInviting] = useState(false);

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

  // Enviar invitación a nuevo usuario
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      showToast("error", "Introduce un correo electrónico válido");
      return;
    }

    setIsInviting(true);
    try {
      await inviteMember(inviteEmail, inviteRole, inviteName);
      setInviteEmail("");
      setInviteName("");
      showToast("success", `Invitación enviada a ${inviteEmail} con rol ${getRoleLabel(inviteRole)}`);
    } catch (err: any) {
      showToast("error", err?.message || "Error al enviar invitación");
    } finally {
      setIsInviting(false);
    }
  };

  // Cambiar rol de miembro
  const handleRoleChange = async (memberId: string, newRole: TenantRole) => {
    try {
      await updateMemberRole(memberId, newRole);
      showToast("success", "Rol del miembro actualizado");
    } catch (err: any) {
      showToast("error", err?.message || "No se pudo actualizar el rol");
    }
  };

  // Eliminar miembro
  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    if (!confirm(`¿Eliminar al miembro ${memberEmail} de la organización?`)) return;
    try {
      await removeMember(memberId);
      showToast("success", `Miembro ${memberEmail} revocado`);
    } catch (err: any) {
      showToast("error", err?.message || "No se pudo eliminar el miembro");
    }
  };

  const getRoleBadge = (role: TenantRole) => {
    switch (role) {
      case "owner":
        return (
          <Badge
            variant="default"
            className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700/60 gap-1 font-mono text-[11px]"
          >
            <Crown className="h-3 w-3 text-amber-500" />
            <span>Propietario</span>
          </Badge>
        );
      case "admin":
        return (
          <Badge
            variant="default"
            className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700/60 gap-1 font-mono text-[11px]"
          >
            <Shield className="h-3 w-3 text-blue-500" />
            <span>Administrador</span>
          </Badge>
        );
      case "operator":
        return (
          <Badge
            variant="default"
            className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60 gap-1 font-mono text-[11px]"
          >
            <Zap className="h-3 w-3 text-emerald-500" />
            <span>Operario de Campo</span>
          </Badge>
        );
      case "viewer":
        return (
          <Badge
            variant="default"
            className="bg-zinc-500/20 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700/60 gap-1 font-mono text-[11px]"
          >
            <Eye className="h-3 w-3 text-zinc-500" />
            <span>Visualizador</span>
          </Badge>
        );
    }
  };

  const getRoleLabel = (role: TenantRole) => {
    switch (role) {
      case "owner":
        return "Propietario (Acceso Total + Facturación)";
      case "admin":
        return "Administrador (Gestión de Empresa y Equipo)";
      case "operator":
        return "Operario de Campo (Captura Atómica en Terreno)";
      case "viewer":
        return "Visualizador (Solo Lectura)";
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
                    <Link href="/dashboard">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs font-mono border-zinc-300 dark:border-zinc-700"
                      >
                        <CreditCard className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Gestionar con Stripe</span>
                      </Button>
                    </Link>
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
          <section className="space-y-6">
            {/* OMNIBARRA DE INVITACIÓN RÁPIDA (< 3 SEGUNDOS) */}
            {isAdmin && (
              <div
                className={`p-5 rounded-2xl border transition-all ${
                  outdoorMode
                    ? "border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm"
                }`}
              >
                <h3 className="text-sm font-bold font-mono tracking-tight mb-3 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-emerald-500" />
                  <span>Invitar a Nuevo Miembro al Equipo</span>
                </h3>

                <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                  <div className="flex-1">
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="operario@empresa.com"
                      className={`font-mono text-sm ${outdoorMode ? "border-2 border-black" : ""}`}
                      required
                    />
                  </div>

                  <div className="sm:w-48">
                    <Input
                      type="text"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="Nombre (opcional)"
                      className={`font-mono text-sm ${outdoorMode ? "border-2 border-black" : ""}`}
                    />
                  </div>

                  <div className="sm:w-56">
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as TenantRole)}
                      className={`w-full h-10 px-3 rounded-lg text-xs font-mono font-semibold border bg-white dark:bg-zinc-900 ${
                        outdoorMode ? "border-2 border-black" : "border-zinc-300 dark:border-zinc-700"
                      }`}
                    >
                      <option value="operator">⚡ Operario de Campo</option>
                      <option value="admin">🛡️ Administrador</option>
                      <option value="viewer">👁️ Visualizador</option>
                    </select>
                  </div>

                  <Button
                    type="submit"
                    disabled={isInviting || !inviteEmail.trim()}
                    className={`gap-1.5 font-mono font-bold text-xs shrink-0 ${
                      outdoorMode
                        ? "bg-black text-white hover:bg-zinc-800 border-2 border-black"
                        : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    }`}
                  >
                    {isInviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    <span>Enviar Invitación</span>
                  </Button>
                </form>
              </div>
            )}

            {/* LISTADO DE MIEMBROS ACTIVOS Y PENDIENTES */}
            <div
              className={`rounded-2xl border overflow-hidden transition-all ${
                outdoorMode
                  ? "border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm"
              }`}
            >
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm tracking-tight">Miembros de la Organización</h3>
                  <Badge variant="outline" className="font-mono text-xs">
                    {members.length} usuarios
                  </Badge>
                </div>
              </div>

              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-10 w-10 rounded-xl flex items-center justify-center font-mono font-bold text-sm ${
                          outdoorMode
                            ? "bg-black text-white"
                            : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        {member.displayName?.charAt(0).toUpperCase() || member.email.charAt(0).toUpperCase()}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">
                            {member.displayName || member.email.split("@")[0]}
                          </span>
                          {member.id === user?.uid && (
                            <Badge variant="tag" className="text-[10px] py-0 px-1.5">
                              Tú
                            </Badge>
                          )}
                          {member.status === "pending" && (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono border-amber-400 text-amber-600 dark:text-amber-400 py-0"
                            >
                              Pendiente
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 font-mono">{member.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      {/* Insignia o Selector de Rol */}
                      {isAdmin && member.role !== "owner" && member.id !== user?.uid ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value as TenantRole)}
                          className={`h-8 px-2.5 rounded-lg text-xs font-mono font-semibold border bg-white dark:bg-zinc-900 ${
                            outdoorMode ? "border-2 border-black" : "border-zinc-300 dark:border-zinc-700"
                          }`}
                        >
                          <option value="operator">⚡ Operario</option>
                          <option value="admin">🛡️ Administrador</option>
                          <option value="viewer">👁️ Visualizador</option>
                        </select>
                      ) : (
                        getRoleBadge(member.role)
                      )}

                      {/* Botón de Revocar / Eliminar */}
                      {isAdmin && member.role !== "owner" && member.id !== user?.uid && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.id, member.email)}
                          className="p-1.5 text-zinc-400 hover:text-rose-600 transition-colors rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Eliminar de la organización"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
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
      </div>
    </div>
  );
}
