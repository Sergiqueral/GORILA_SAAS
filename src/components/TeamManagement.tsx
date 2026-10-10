"use client";

import React, { useState, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { TenantMember, TenantRole } from "@/types/tenant";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Plus,
  Trash2,
  AlertCircle,
  Copy,
  Check,
  Shield,
  Crown,
  Zap,
  Eye,
  Mail,
  Loader2,
  Lock,
  Search,
  Building2,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface TeamManagementProps {
  outdoorMode?: boolean;
  onToast?: (type: "success" | "error", text: string) => void;
  onOpenBilling?: () => void;
}

export function TeamManagement({ outdoorMode = false, onToast, onOpenBilling }: TeamManagementProps) {
  const { user } = useAuth();
  const {
    tenant,
    members,
    currentRole,
    isAdmin,
    inviteMember,
    updateMemberRole,
    removeMember,
  } = useTenant();

  // -------------------------------------------------------------
  // Formulario Atómico (Ley de la Fricción Cero: < 3 campos obligatorios)
  // Campo 1: Email (obligatorio)
  // Campo 2: Rol (selector rápido, default 'operator')
  // -------------------------------------------------------------
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TenantRole>("operator");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Estados de filtrado y búsqueda
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pending">("all");

  // Estado para feedback de copiado al portapapeles
  const [copiedMemberId, setCopiedMemberId] = useState<string | null>(null);

  // Estado para colapsar/expandir el panel de arquitectura multi-workspace
  const [showArchitectureHelp, setShowArchitectureHelp] = useState(false);

  // Referencia para reenfocar el input de email inmediatamente tras enviar
  const emailInputRef = useRef<HTMLInputElement>(null);

  const notify = (type: "success" | "error", message: string) => {
    if (onToast) {
      onToast(type, message);
    }
    if (type === "error") {
      setLocalError(message);
    } else {
      setLocalError(null);
    }
  };

  // -------------------------------------------------------------
  // Envío Atómico con Optimistic UI (< 100ms)
  // -------------------------------------------------------------
  const handleSubmitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      notify("error", "Introduce un correo electrónico válido");
      emailInputRef.current?.focus();
      return;
    }

    if (!isAdmin) {
      notify("error", "No tienes permisos de Administrador para invitar miembros");
      return;
    }

    // Comprobar si ya existe localmente antes de invocar Firebase
    const existing = members.find((m) => m.email.toLowerCase() === cleanEmail);
    if (existing) {
      notify("error", `El usuario ${cleanEmail} ya está registrado en este workspace.`);
      return;
    }

    const targetRole = role;
    const targetEmail = cleanEmail;

    // Reseteo instantáneo de la interfaz (Fricción Cero)
    setEmail("");
    setIsSubmitting(true);

    try {
      // Auto-derivar nombre de pantalla para no requerir un campo adicional (<3 campos obligatorios)
      const autoName = cleanEmail.split("@")[0];
      await inviteMember(targetEmail, targetRole, autoName);
      notify("success", `Invitación enviada a ${targetEmail} con rol de ${getRoleLabel(targetRole)}.`);
    } catch (err: any) {
      console.error("Fallo al invitar:", err);
      // Restaurar el email en caso de fallo para no perder el trabajo del usuario
      setEmail(targetEmail);
      notify("error", err?.message || "No se pudo registrar la invitación. Revisa tus permisos.");
    } finally {
      setIsSubmitting(false);
      // Mantener foco en el input para permitir invitaciones en ráfaga
      emailInputRef.current?.focus();
    }
  };

  // -------------------------------------------------------------
  // Cambio de Rol Optimista
  // -------------------------------------------------------------
  const handleRoleChange = async (memberId: string, newRole: TenantRole) => {
    try {
      await updateMemberRole(memberId, newRole);
      notify("success", `Rol actualizado a ${getRoleLabel(newRole)} correctamente.`);
    } catch (err: any) {
      notify("error", err?.message || "Error al modificar el rol del miembro.");
    }
  };

  // -------------------------------------------------------------
  // Revocar / Eliminar Miembro Optimista
  // -------------------------------------------------------------
  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    const isPending = members.find((m) => m.id === memberId)?.status === "pending";
    const confirmMessage = isPending
      ? `¿Deseas revocar la invitación enviada a ${memberEmail}?`
      : `¿Estás seguro de eliminar a ${memberEmail} de la organización?`;

    if (window.confirm(confirmMessage)) {
      try {
        await removeMember(memberId);
        notify(
          "success",
          isPending ? "Invitación revocada correctamente." : "Miembro eliminado de la organización."
        );
      } catch (err: any) {
        notify("error", err?.message || "Error al eliminar miembro.");
      }
    }
  };

  // -------------------------------------------------------------
  // Copiar enlace de invitación
  // -------------------------------------------------------------
  const handleCopyInviteLink = (memberId: string, memberEmail: string) => {
    if (typeof window === "undefined") return;
    const origin = window.location.origin;
    const inviteUrl = `${origin}/signup?tenantId=${tenant?.id || ""}&email=${encodeURIComponent(
      memberEmail
    )}`;

    navigator.clipboard
      .writeText(inviteUrl)
      .then(() => {
        setCopiedMemberId(memberId);
        notify("success", "Enlace de invitación copiado al portapapeles");
        setTimeout(() => setCopiedMemberId(null), 3000);
      })
      .catch(() => {
        notify("error", "No se pudo copiar el enlace al portapapeles");
      });
  };

  // -------------------------------------------------------------
  // Filtrado y Búsqueda de Miembros
  // -------------------------------------------------------------
  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      // Filtro de estado
      if (statusFilter === "active" && member.status !== "active") return false;
      if (statusFilter === "pending" && member.status !== "pending") return false;

      // Filtro de búsqueda
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchEmail = member.email.toLowerCase().includes(q);
      const matchName = member.displayName ? member.displayName.toLowerCase().includes(q) : false;
      const matchRole = member.role.toLowerCase().includes(q);
      return matchEmail || matchName || matchRole;
    });
  }, [members, statusFilter, searchQuery]);

  const activeCount = useMemo(() => members.filter((m) => m.status === "active").length, [members]);
  const pendingCount = useMemo(() => members.filter((m) => m.status === "pending").length, [members]);

  // Helpers de etiquetas visuales
  function getRoleLabel(roleName: TenantRole): string {
    switch (roleName) {
      case "owner":
        return "Propietario";
      case "admin":
        return "Administrador";
      case "operator":
        return "Operario";
      case "viewer":
        return "Visualizador";
      default:
        return roleName;
    }
  }

  function renderRoleBadge(memberRole: TenantRole) {
    switch (memberRole) {
      case "owner":
        return (
          <Badge
            variant="outline"
            className="border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono text-[11px] gap-1 px-2.5 py-0.5"
          >
            <Crown className="h-3 w-3" />
            <span>Propietario</span>
          </Badge>
        );
      case "admin":
        return (
          <Badge
            variant="outline"
            className="border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono text-[11px] gap-1 px-2.5 py-0.5"
          >
            <Shield className="h-3 w-3" />
            <span>Admin</span>
          </Badge>
        );
      case "operator":
        return (
          <Badge
            variant="outline"
            className="border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] gap-1 px-2.5 py-0.5"
          >
            <Zap className="h-3 w-3" />
            <span>Operario</span>
          </Badge>
        );
      case "viewer":
        return (
          <Badge
            variant="outline"
            className="border-zinc-400 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 font-mono text-[11px] gap-1 px-2.5 py-0.5"
          >
            <Eye className="h-3 w-3" />
            <span>Lector</span>
          </Badge>
        );
    }
  }

  return (
    <div className="space-y-6">
      {/* ============================================================ */}
      {/* 1. CABECERA Y METRICAS DEL WORKSPACE                         */}
      {/* ============================================================ */}
      <div
        className={`p-6 rounded-2xl border transition-all ${
          outdoorMode
            ? "border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-lg font-bold tracking-tight">Gestión del Equipo & Acceso Soberano</h2>
            </div>
            <p className="text-xs text-zinc-500 font-mono mt-1 flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5" />
              <span>Workspace Activo:</span>
              <strong className="text-zinc-800 dark:text-zinc-200">{tenant?.name || "Organización"}</strong>
              <code className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                {tenant?.id}
              </code>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-mono text-xs px-2.5 py-1"
            >
              {activeCount} Activos
            </Badge>
            {pendingCount > 0 && (
              <Badge
                variant="outline"
                className="border-amber-500/40 text-amber-600 dark:text-amber-400 font-mono text-xs px-2.5 py-1"
              >
                {pendingCount} Pendientes
              </Badge>
            )}
            <Badge
              variant="outline"
              className="border-blue-500/40 text-blue-600 dark:text-blue-400 font-mono text-xs px-2.5 py-1"
            >
              Asientos: {members.length} / {1 + (tenant?.subscription?.additionalSeats || 0)}
            </Badge>
            {onOpenBilling && (
              <Button
                size="sm"
                variant="outline"
                onClick={onOpenBilling}
                className={`text-xs font-mono gap-1 h-7 px-2.5 ${
                  outdoorMode ? "border-2 border-black bg-white hover:bg-black hover:text-white" : ""
                }`}
              >
                <Plus className="h-3 w-3 text-emerald-500" />
                <span>Ampliar Asientos</span>
              </Button>
            )}
            <Badge variant="outline" className="font-mono text-xs px-2.5 py-1">
              Tu rol: {getRoleLabel(currentRole)}
            </Badge>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 2. FORMULARIO ATOMICO (< 3 CAMPOS OBLIGATORIOS)              */}
        {/* ============================================================ */}
        {isAdmin ? (
          <div className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold font-mono tracking-wider uppercase text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5 text-emerald-500" />
                <span>Invitar miembro con Fricción Cero</span>
              </h3>
              <span className="text-[11px] font-mono text-zinc-400">
                Solo 2 campos obligatorios (Email + Rol) · Optimistic UI &lt; 100ms
              </span>
            </div>

            <form
              onSubmit={handleSubmitInvite}
              className="flex flex-col md:flex-row gap-3 items-stretch md:items-center"
              noValidate
            >
              {/* CAMPO 1: EMAIL (OBLIGATORIO) */}
              <div className="flex-1 relative">
                <label htmlFor="invite-email-input" className="sr-only">
                  Correo electrónico del nuevo miembro
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <Input
                    id="invite-email-input"
                    ref={emailInputRef}
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    enterKeyHint="send"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operario@empresa.com"
                    required
                    disabled={isSubmitting}
                    className={`pl-9 font-mono text-sm h-11 transition-all ${
                      outdoorMode
                        ? "border-2 border-black bg-white text-black font-bold focus:ring-0"
                        : "border-zinc-300 dark:border-zinc-700 focus:border-emerald-500"
                    }`}
                  />
                </div>
              </div>

              {/* CAMPO 2: ROL (OBLIGATORIO VIA CHIPS O SELECTOR ATOMICO) */}
              <div className="w-full md:w-60">
                <label htmlFor="invite-role-select" className="sr-only">
                  Rol en la organización
                </label>
                <div className="relative">
                  <select
                    id="invite-role-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value as TenantRole)}
                    disabled={isSubmitting}
                    className={`w-full h-11 px-3 rounded-lg text-xs font-mono font-semibold border transition-all ${
                      outdoorMode
                        ? "border-2 border-black bg-white text-black font-bold"
                        : "border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/90 text-zinc-800 dark:text-zinc-200"
                    }`}
                  >
                    <option value="operator">⚡ Operario de Campo (Captura)</option>
                    <option value="admin">🛡️ Administrador (Gestión)</option>
                    <option value="viewer">👁️ Visualizador (Solo Lectura)</option>
                  </select>
                </div>
              </div>

              {/* BOTON DE ACCION INSTANTANEA */}
              <Button
                type="submit"
                disabled={isSubmitting || !email.trim()}
                className={`h-11 px-5 gap-2 font-mono font-bold text-xs shrink-0 transition-transform active:scale-95 ${
                  outdoorMode
                    ? "bg-black text-white hover:bg-zinc-800 border-2 border-black"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600 shadow-sm"
                }`}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                <span>Invitar al Equipo</span>
              </Button>
            </form>

            {/* Banner de error local en caso de fallo */}
            {localError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-mono text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                  <span>{localError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLocalError(null)}
                  className="text-rose-500 hover:text-rose-700 font-bold px-2 py-0.5"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 p-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 text-xs font-mono text-zinc-600 dark:text-zinc-400 flex items-center gap-2.5">
            <Lock className="h-4 w-4 shrink-0 text-zinc-500" />
            <span>
              Tienes rol de <strong>{getRoleLabel(currentRole)}</strong>. Solo los Administradores o el Propietario pueden emitir nuevas invitaciones.
            </span>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 3. CALLOUT ARQUITECTONICO: MULTI-WORKSPACE & AISLAMIENTO    */}
      {/* ============================================================ */}
      <div
        className={`p-4 rounded-xl border transition-all ${
          outdoorMode
            ? "border-2 border-black bg-zinc-50 text-black"
            : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-zinc-600 dark:text-zinc-400"
        }`}
      >
        <button
          type="button"
          onClick={() => setShowArchitectureHelp(!showArchitectureHelp)}
          className="w-full flex items-center justify-between text-left font-mono text-xs font-bold text-zinc-700 dark:text-zinc-300 focus:outline-none"
        >
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-emerald-500" />
            <span>¿Qué ocurre si el Superadmin pertenece a un Workspace y los invitados a otro?</span>
          </div>
          {showArchitectureHelp ? (
            <ChevronUp className="h-4 w-4 text-zinc-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          )}
        </button>

        {showArchitectureHelp && (
          <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 text-xs font-mono space-y-2 leading-relaxed">
            <p>
              En <strong>Gorila SaaS</strong>, la identidad de usuario (Firebase Auth UID) está <strong>completamente desacoplada</strong> de los Workspaces:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-[11px]">
              <li>
                <strong>Pertenencia Multi-Tenant:</strong> Un usuario puede pertenecer a <em>N</em> workspaces simultáneamente (registrado en <code className="bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded">tenants/{'{tenantId}'}/members/{'{uid}'}</code>).
              </li>
              <li>
                <strong>Roles Aislados por Organización:</strong> El Superadmin puede ser <em>Propietario</em> en su empresa principal, pero ser únicamente <em>Operario</em> o <em>Visualizador</em> en un workspace cliente o subcontratista. Los permisos no se filtran ni contaminan entre tenants.
              </li>
              <li>
                <strong>Invitaciones Segregadas:</strong> Cuando invitas a un operario aquí, la invitación se genera exclusivamente bajo este workspace (<code className="bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded">{tenant?.id}</code>). Si el invitado ya tiene su propia cuenta o pertenece a otra empresa, al iniciar sesión podrá conmutar entre workspaces sin perder su soberanía ni mezclar datos.
              </li>
              <li>
                <strong>Cero Fuga en Firestore:</strong> Las reglas de seguridad de Firestore (<code className="bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded">firestore.rules</code>) validan que cada consulta <code className="bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded">isTenantMember(tenantId)</code> coincida exactamente con el documento solicitado.
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 4. LISTADO DE MIEMBROS Y ESTADOS (ACTIVOS VS PENDIENTES)    */}
      {/* ============================================================ */}
      <div
        className={`rounded-2xl border overflow-hidden transition-all ${
          outdoorMode
            ? "border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm"
        }`}
      >
        {/* Barra de Filtros y Búsqueda */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200/50 dark:border-zinc-700/50 self-start">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                statusFilter === "all"
                  ? outdoorMode
                    ? "bg-black text-white"
                    : "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              Todos ({members.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                statusFilter === "active"
                  ? outdoorMode
                    ? "bg-black text-white"
                    : "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              Activos ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("pending")}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                statusFilter === "pending"
                  ? outdoorMode
                    ? "bg-black text-white"
                    : "bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              Invitaciones ({pendingCount})
            </button>
          </div>

          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por email o rol..."
              className={`pl-8 h-9 text-xs font-mono ${
                outdoorMode ? "border-2 border-black" : ""
              }`}
            />
          </div>
        </div>

        {/* Lista de Miembros */}
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {filteredMembers.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="h-8 w-8 mx-auto text-zinc-400 mb-2 opacity-50" />
              <p className="text-sm font-mono text-zinc-500">
                {searchQuery
                  ? "No se encontraron miembros con ese criterio de búsqueda."
                  : statusFilter === "pending"
                  ? "No hay invitaciones pendientes."
                  : "No hay miembros en esta vista."}
              </p>
            </div>
          ) : (
            filteredMembers.map((member) => {
              const isCurrentUser = member.id === user?.uid || member.email.toLowerCase() === user?.email?.toLowerCase();
              const isOwnerRole = member.role === "owner";
              const isPending = member.status === "pending";

              return (
                <div
                  key={member.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    isPending
                      ? "bg-amber-500/[0.03] hover:bg-amber-500/[0.06]"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                  }`}
                >
                  {/* Avatar y Datos del Miembro */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center font-mono font-bold text-sm shrink-0 ${
                        outdoorMode
                          ? "border-2 border-black bg-black text-white"
                          : isPending
                          ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                          : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {member.displayName?.charAt(0).toUpperCase() ||
                        member.email.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">
                          {member.displayName || member.email.split("@")[0]}
                        </span>

                        {isCurrentUser && (
                          <Badge variant="tag" className="text-[10px] py-0 px-1.5 font-mono">
                            Tú
                          </Badge>
                        )}

                        {isPending ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 py-0"
                          >
                            Invitación Pendiente
                          </Badge>
                        ) : (
                          <span
                            className="h-2 w-2 rounded-full bg-emerald-500 inline-block"
                            title="Usuario Activo"
                          />
                        )}
                      </div>

                      <p className="text-xs text-zinc-500 font-mono mt-0.5">{member.email}</p>
                    </div>
                  </div>

                  {/* Acciones y Gestión de Rol */}
                  <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
                    {/* Botón rápido de copiar enlace para invitaciones pendientes */}
                    {isPending && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyInviteLink(member.id, member.email)}
                        className={`h-8 px-2.5 text-xs font-mono gap-1.5 ${
                          outdoorMode ? "border-2 border-black" : "border-zinc-300 dark:border-zinc-700"
                        }`}
                        title="Copiar enlace directo de invitación"
                      >
                        {copiedMemberId === member.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 text-zinc-500" />
                            <span>Enlace</span>
                          </>
                        )}
                      </Button>
                    )}

                    {/* Selector de Rol o Insignia Fija */}
                    {isAdmin && !isOwnerRole && !isCurrentUser ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value as TenantRole)}
                        className={`h-8 px-2.5 rounded-lg text-xs font-mono font-semibold border bg-white dark:bg-zinc-900 ${
                          outdoorMode
                            ? "border-2 border-black text-black font-bold"
                            : "border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200"
                        }`}
                      >
                        <option value="operator">⚡ Operario</option>
                        <option value="admin">🛡️ Administrador</option>
                        <option value="viewer">👁️ Visualizador</option>
                      </select>
                    ) : (
                      renderRoleBadge(member.role)
                    )}

                    {/* Botón de Revocar Invitación o Eliminar Miembro */}
                    {isAdmin && !isOwnerRole && !isCurrentUser && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.id, member.email)}
                        className="p-1.5 text-zinc-400 hover:text-rose-600 transition-colors rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title={isPending ? "Revocar invitación" : "Eliminar de la organización"}
                        aria-label={isPending ? `Revocar invitación a ${member.email}` : `Eliminar a ${member.email}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
