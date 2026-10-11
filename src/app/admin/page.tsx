"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { isSuperAdminEmail } from "@/lib/superadmin";
import { Tenant, UserProfile, TenantMember, TenantRole } from "@/types/tenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert,
  ShieldCheck,
  Building2,
  Users,
  CreditCard,
  Crown,
  Search,
  ExternalLink,
  Eye,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  SlidersHorizontal,
  Plus,
  Sparkles,
  Zap,
  DollarSign,
  Copy,
  Check,
  UserCheck,
} from "lucide-react";

interface AdminOverviewData {
  isConfigured: boolean;
  superAdminEmail: string;
  stats: {
    totalTenants: number;
    totalUsers: number;
    proTenants: number;
    totalAdditionalSeats: number;
    estimatedMrr: number;
  };
  tenants: (Tenant & { membersCount?: number; ownerEmail?: string; members?: TenantMember[] })[];
  users: (UserProfile & { uid: string })[];
}

export default function SuperAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"tenants" | "users" | "finops">("tenants");
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  // Estados del modal de Asignar Propietario
  const [ownerModalTenant, setOwnerModalTenant] = useState<Tenant | null>(null);
  const [selectedNewOwnerUid, setSelectedNewOwnerUid] = useState<string>("");
  const [isSubmittingOwner, setIsSubmittingOwner] = useState(false);

  // Estados del modal de Ajustar Plan / Bypass Pro
  const [planModalTenant, setPlanModalTenant] = useState<Tenant | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<"Free" | "Pro">("Pro");
  const [additionalSeatsInput, setAdditionalSeatsInput] = useState<number>(0);
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);

  // Estados del modal de Modificar Rol de Usuario
  const [roleModalUser, setRoleModalUser] = useState<(UserProfile & { uid: string }) | null>(null);
  const [selectedRoleTenantId, setSelectedRoleTenantId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<TenantRole>("owner");
  const [selectedGlobalRole, setSelectedGlobalRole] = useState<string>("Free User");
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);

  // Notificación de acción realizada
  const [actionNotification, setActionNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const isSuperAdmin = useMemo(() => {
    return isSuperAdminEmail(user?.email);
  }, [user]);

  // Cargar visión general del backend
  const fetchOverview = async (isBackground = false) => {
    if (!user) return;
    try {
      if (isBackground) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const idToken = await user.getIdToken();
      const res = await fetch("/api/admin/overview", {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const rawText = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(rawText);
      } catch {
        throw new Error(`Respuesta inválida del servidor (HTTP ${res.status}): Comprueba la consola del servidor.`);
      }

      if (!res.ok) {
        throw new Error(json.message || json.error || `Error ${res.status}: Fallo al conectar con el Cerebro Admin`);
      }

      setData(json);
    } catch (err: any) {
      console.error("[SuperAdmin] Error al cargar overview:", err);
      setError(err?.message || "No se pudo sincronizar la información del SuperAdmin");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user && isSuperAdmin) {
      fetchOverview();
    } else if (!authLoading && user && !isSuperAdmin) {
      setLoading(false);
    }
  }, [authLoading, user, isSuperAdmin]);

  // Copiar UID al portapapeles
  const handleCopyUid = (uid: string) => {
    navigator.clipboard.writeText(uid);
    setCopiedUid(uid);
    setTimeout(() => setCopiedUid(null), 2000);
  };

  // Entrar como soporte / Auditar espacio de trabajo
  const handleImpersonateTenant = (tenantId: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("gorila_active_tenant", tenantId);
      router.push("/dashboard");
    }
  };

  // Confirmar transferencia de propiedad
  const handleConfirmSetOwner = async () => {
    if (!user || !ownerModalTenant || !selectedNewOwnerUid) return;
    try {
      setIsSubmittingOwner(true);
      const idToken = await user.getIdToken();
      const res = await fetch("/api/admin/set-owner", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          tenantId: ownerModalTenant.id,
          newOwnerUid: selectedNewOwnerUid,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Error al transferir la propiedad");
      }

      setActionNotification({
        type: "success",
        message: `¡Propiedad del espacio ${ownerModalTenant.name} asignada con éxito!`,
      });
      setOwnerModalTenant(null);
      setSelectedNewOwnerUid("");
      fetchOverview(true);
    } catch (err: any) {
      setActionNotification({
        type: "error",
        message: err?.message || "Error al asignar propietario",
      });
    } finally {
      setIsSubmittingOwner(false);
    }
  };

  // Confirmar cambio manual de plan / bypass Pro
  const handleConfirmSetPlan = async () => {
    if (!user || !planModalTenant) return;
    try {
      setIsSubmittingPlan(true);
      const idToken = await user.getIdToken();
      const res = await fetch("/api/admin/set-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          tenantId: planModalTenant.id,
          plan: selectedPlan,
          additionalSeats: additionalSeatsInput,
          reason: "Ajuste manual desde SuperAdmin Cockpit",
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Error al actualizar plan");
      }

      setActionNotification({
        type: "success",
        message: `¡Plan de ${planModalTenant.name} actualizado a ${selectedPlan} (${additionalSeatsInput} asientos)!`,
      });
      setPlanModalTenant(null);
      fetchOverview(true);
    } catch (err: any) {
      setActionNotification({
        type: "error",
        message: err?.message || "Error al ajustar plan",
      });
    } finally {
      setIsSubmittingPlan(false);
    }
  };

  // Abrir modal de gestión de rol de usuario
  const handleOpenRoleModal = (targetUser: UserProfile & { uid: string }) => {
    setRoleModalUser(targetUser);
    const initialTenantId = targetUser.tenantId || (data?.tenants[0]?.id || "");
    setSelectedRoleTenantId(initialTenantId);

    // Determinar el rol actual en ese tenant si existe
    const targetTenant = data?.tenants.find((t) => t.id === initialTenantId);
    const memberRecord = targetTenant?.members?.find((m) => m.id === targetUser.uid);
    if (memberRecord) {
      setSelectedRole(memberRecord.role);
    } else if (targetTenant?.ownerId === targetUser.uid) {
      setSelectedRole("owner");
    } else {
      setSelectedRole("owner");
    }

    setSelectedGlobalRole(targetUser.role || "Free User");
  };

  // Cambiar el tenant seleccionado en el modal de rol
  const handleTenantSelectChange = (newTenantId: string) => {
    setSelectedRoleTenantId(newTenantId);
    const targetTenant = data?.tenants.find((t) => t.id === newTenantId);
    const memberRecord = targetTenant?.members?.find((m) => m.id === roleModalUser?.uid);
    if (memberRecord) {
      setSelectedRole(memberRecord.role);
    } else if (targetTenant?.ownerId === roleModalUser?.uid) {
      setSelectedRole("owner");
    } else {
      setSelectedRole("owner");
    }
  };

  // Confirmar cambio de rol de usuario y espacio
  const handleConfirmSetRole = async () => {
    if (!user || !roleModalUser || !selectedRoleTenantId) return;
    try {
      setIsSubmittingRole(true);
      const idToken = await user.getIdToken();
      const res = await fetch("/api/admin/set-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          tenantId: selectedRoleTenantId,
          uid: roleModalUser.uid,
          role: selectedRole,
          globalRole: selectedGlobalRole,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Error al actualizar rol del usuario");
      }

      setActionNotification({
        type: "success",
        message: `¡Rol de ${roleModalUser.email} actualizado con éxito a "${selectedRole}" en ${selectedRoleTenantId}!`,
      });
      setRoleModalUser(null);
      fetchOverview(true);
    } catch (err: any) {
      setActionNotification({
        type: "error",
        message: err?.message || "Error al modificar rol",
      });
    } finally {
      setIsSubmittingRole(false);
    }
  };

  // Filtrado de tenants por búsqueda
  const filteredTenants = useMemo(() => {
    if (!data?.tenants) return [];
    if (!searchQuery.trim()) return data.tenants;
    const q = searchQuery.toLowerCase().trim();
    return data.tenants.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) ||
        t.id?.toLowerCase().includes(q) ||
        t.cif?.toLowerCase().includes(q) ||
        t.ownerId?.toLowerCase().includes(q) ||
        t.ownerEmail?.toLowerCase().includes(q)
    );
  }, [data?.tenants, searchQuery]);

  // Filtrado de usuarios por búsqueda
  const filteredUsers = useMemo(() => {
    if (!data?.users) return [];
    if (!searchQuery.trim()) return data.users;
    const q = searchQuery.toLowerCase().trim();
    return data.users.filter(
      (u) =>
        u.email?.toLowerCase().includes(q) ||
        u.displayName?.toLowerCase().includes(q) ||
        u.uid?.toLowerCase().includes(q) ||
        u.tenantId?.toLowerCase().includes(q)
    );
  }, [data?.users, searchQuery]);

  // Si está cargando autenticación
  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center font-mono">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
          <span>Verificando credenciales de Plataforma...</span>
        </div>
      </div>
    );
  }

  // Si no tiene privilegios de SuperAdmin
  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 font-mono">
        <div className="max-w-md w-full bg-zinc-900 border-2 border-red-500/50 p-8 rounded-2xl shadow-2xl text-center space-y-6">
          <div className="inline-flex p-4 bg-red-950/50 border border-red-500 rounded-full text-red-400">
            <ShieldAlert className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight text-white uppercase">
              Acceso Restringido
            </h1>
            <p className="text-sm text-zinc-400">
              La cuenta <span className="text-amber-400 font-semibold">{user?.email || "anónima"}</span> no
              tiene autorización para el Centro de Mando SuperAdmin ("God Mode").
            </p>
          </div>
          <Link href="/dashboard">
            <Button className="w-full bg-white text-black hover:bg-zinc-200 border-2 border-black font-bold h-12">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Cockpit
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-amber-400 selection:text-black p-4 sm:p-6 md:p-10 flex flex-col items-center">
      <div className="w-full max-w-6xl space-y-8 pt-4 md:pt-8">
        {/* Banner de Feedback */}
        {actionNotification && (
          <div
            className={`p-4 rounded-xl border-2 flex items-center justify-between text-sm font-mono shadow-md ${
              actionNotification.type === "success"
                ? "bg-emerald-950/70 border-emerald-500 text-emerald-200"
                : "bg-red-950/70 border-red-500 text-red-200"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {actionNotification.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
              )}
              <span>{actionNotification.message}</span>
            </div>
            <button
              onClick={() => setActionNotification(null)}
              className="text-zinc-400 hover:text-white p-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* CABECERA SUPERADMIN */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-zinc-800 pb-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="p-2.5 bg-amber-400 text-black rounded-xl font-bold shadow-[0_0_15px_rgba(251,191,36,0.3)]">
                <Crown className="h-6 w-6" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-mono text-white">
                SuperAdmin <span className="text-amber-400">Backoffice</span>
              </h1>
              <Badge className="bg-zinc-800 border-2 border-amber-400 text-amber-300 font-mono text-xs uppercase px-2 py-0.5">
                God Mode Active
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 font-mono flex items-center gap-2">
              <span>Operador Maestro:</span>
              <span className="text-amber-400 font-bold">{user?.email}</span>
              <span>•</span>
              <span className="text-zinc-500">Gorila SaaS Multi-Tenant Control Hub</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={refreshing || loading}
              onClick={() => fetchOverview(true)}
              className="bg-zinc-900 border-2 border-zinc-700 hover:bg-zinc-800 text-zinc-200 font-mono text-xs gap-1.5 h-10 px-3"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-amber-400" : ""}`} />
              <span>{refreshing ? "Sincronizando..." : "Refrescar"}</span>
            </Button>

            <Link href="/dashboard">
              <Button
                variant="outline"
                size="sm"
                className="bg-zinc-900 border-2 border-zinc-700 hover:border-zinc-500 text-zinc-200 hover:text-white font-mono text-xs gap-1.5 h-10 px-4"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Volver al Cockpit</span>
              </Button>
            </Link>
          </div>
        </header>

        {/* METRICAS FINOPS & PLATAFORMA */}
        {data?.stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900/90 border-2 border-zinc-800 p-4 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
                <span>Empresas Registradas</span>
                <Building2 className="h-4 w-4 text-blue-400" />
              </div>
              <p className="text-2xl sm:text-3xl font-black font-mono text-white">
                {data.stats.totalTenants}
              </p>
              <p className="text-[11px] font-mono text-zinc-500">Espacios de trabajo en Firestore</p>
            </div>

            <div className="bg-zinc-900/90 border-2 border-zinc-800 p-4 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
                <span>Usuarios en Plataforma</span>
                <Users className="h-4 w-4 text-purple-400" />
              </div>
              <p className="text-2xl sm:text-3xl font-black font-mono text-white">
                {data.stats.totalUsers}
              </p>
              <p className="text-[11px] font-mono text-zinc-500">Cuentas Firebase registradas</p>
            </div>

            <div className="bg-zinc-900/90 border-2 border-zinc-800 p-4 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
                <span>Tenants Pro Activos</span>
                <Zap className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
                {data.stats.proTenants}
              </p>
              <p className="text-[11px] font-mono text-zinc-500">
                +{data.stats.totalAdditionalSeats} asientos contratados
              </p>
            </div>

            <div className="bg-zinc-900/90 border-2 border-amber-500/40 p-4 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-amber-300 text-xs font-mono">
                <span>MRR Estimado</span>
                <DollarSign className="h-4 w-4 text-amber-400" />
              </div>
              <p className="text-2xl sm:text-3xl font-black font-mono text-amber-400">
                {data.stats.estimatedMrr} €
              </p>
              <p className="text-[11px] font-mono text-zinc-500">Facturación mensual recurrente</p>
            </div>
          </div>
        )}

        {/* CONTROLES DE PESTAÑAS Y BUSCADOR */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-zinc-900/60 p-3 rounded-2xl border-2 border-zinc-800">
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === "tenants" ? "default" : "ghost"}
              onClick={() => setActiveTab("tenants")}
              className={`font-mono text-xs font-bold gap-2 h-10 px-4 rounded-xl ${
                activeTab === "tenants"
                  ? "bg-amber-400 text-black hover:bg-amber-300 shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              <Building2 className="h-4 w-4" />
              <span>Empresas ({data?.tenants?.length || 0})</span>
            </Button>

            <Button
              variant={activeTab === "users" ? "default" : "ghost"}
              onClick={() => setActiveTab("users")}
              className={`font-mono text-xs font-bold gap-2 h-10 px-4 rounded-xl ${
                activeTab === "users"
                  ? "bg-amber-400 text-black hover:bg-amber-300 shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Usuarios ({data?.users?.length || 0})</span>
            </Button>

            <Button
              variant={activeTab === "finops" ? "default" : "ghost"}
              onClick={() => setActiveTab("finops")}
              className={`font-mono text-xs font-bold gap-2 h-10 px-4 rounded-xl ${
                activeTab === "finops"
                  ? "bg-amber-400 text-black hover:bg-amber-300 shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              <CreditCard className="h-4 w-4" />
              <span>FinOps & Stripe</span>
            </Button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 absolute left-3 top-3 text-zinc-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, CIF, email..."
              className="pl-9 bg-zinc-950 border-2 border-zinc-800 text-xs font-mono h-10 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-amber-400 focus-visible:border-amber-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-3 text-xs text-zinc-500 hover:text-zinc-200"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL: LOADING O TAB SELECCIONADA */}
        {loading ? (
          <div className="p-16 border-2 border-zinc-800 rounded-2xl bg-zinc-900/40 flex flex-col items-center justify-center space-y-4 font-mono text-sm text-zinc-400">
            <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
            <p>Consultando base de datos Firestore y topología Multitenant...</p>
          </div>
        ) : error ? (
          <div className="p-8 border-2 border-red-500/60 bg-red-950/40 rounded-2xl space-y-4 font-mono">
            <div className="flex items-center gap-3 text-red-400 font-bold text-base">
              <AlertTriangle className="h-6 w-6" />
              <span>Aviso de Configuración del Servidor</span>
            </div>
            <p className="text-sm text-zinc-300">{error}</p>
            <div className="p-4 bg-black/60 rounded-xl border border-zinc-800 text-xs space-y-2">
              <p className="font-bold text-amber-400">
                Paso para habilitar Firebase Admin SDK en el servidor:
              </p>
              <p className="text-zinc-400">
                Genera tu clave de servicio en Firebase Console &gt; Configuración del Proyecto &gt;
                Cuentas de servicio y añade las claves en <code className="text-white">.env.local</code>:
              </p>
              <pre className="text-emerald-400 overflow-x-auto p-2 bg-zinc-950 rounded border border-zinc-800">
                FIREBASE_ADMIN_CLIENT_EMAIL="firebase-adminsdk-xxx@gorila-3b33c.iam.gserviceaccount.com"{"\n"}
                FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
              </pre>
            </div>
          </div>
        ) : activeTab === "tenants" ? (
          /* TAB 1: GESTIÓN DE EMPRESAS / TENANTS */
          <div className="space-y-4">
            <div className="flex items-center justify-between font-mono text-xs text-zinc-400 px-1">
              <span>Listado de Espacios de Trabajo ({filteredTenants.length})</span>
              <span>Acciones: Transferir Propiedad • Bypass Pro • Soporte</span>
            </div>

            {filteredTenants.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed border-zinc-800 rounded-2xl font-mono text-zinc-500 text-sm">
                No se encontraron empresas con el criterio de búsqueda "{searchQuery}".
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredTenants.map((tenant) => {
                  const isPro = tenant.plan === "Pro" || tenant.subscription?.status === "active";
                  const additionalSeats = tenant.subscription?.additionalSeats || 0;

                  return (
                    <div
                      key={tenant.id}
                      className="bg-zinc-900 border-2 border-zinc-800 hover:border-zinc-700 rounded-2xl p-5 transition-all space-y-4 shadow-lg"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                              <Building2 className="h-5 w-5 text-amber-400" />
                              {tenant.name || "Sin Nombre Comercial"}
                            </h3>

                            {isPro ? (
                              <Badge className="bg-emerald-500/20 text-emerald-300 border-2 border-emerald-500 font-mono text-[10px] font-bold uppercase">
                                Plan Pro ({additionalSeats > 0 ? `+${additionalSeats} Asientos` : "Base"})
                              </Badge>
                            ) : (
                              <Badge className="bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono text-[10px] uppercase">
                                Free Tier
                              </Badge>
                            )}

                            {tenant.cif && (
                              <Badge variant="outline" className="font-mono text-[10px] text-zinc-400">
                                CIF: {tenant.cif}
                              </Badge>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-zinc-400">
                            <span>
                              ID: <code className="text-zinc-300">{tenant.id}</code>
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Crown className="h-3 w-3 text-amber-400" />
                              Propietario:{" "}
                              <strong className="text-zinc-200">
                                {tenant.ownerEmail || tenant.ownerId || "No asignado"}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>Miembros: <strong className="text-zinc-200">{tenant.membersCount || 1}</strong></span>
                            {tenant.createdAt && (
                              <>
                                <span>•</span>
                                <span>Creado: {new Date(tenant.createdAt).toLocaleDateString()}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* BOTONES TÁCTILES DE GESTIÓN RÁPIDA */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* 1. Asignar Propietario */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setOwnerModalTenant(tenant);
                              setSelectedNewOwnerUid(tenant.ownerId || "");
                            }}
                            className="bg-zinc-950 border-2 border-amber-500/60 hover:bg-amber-400 hover:text-black hover:border-amber-400 font-mono text-xs font-semibold h-9 gap-1.5 transition-all"
                            title="Asignar o transferir la propiedad (owner) a cualquier usuario registrado"
                          >
                            <Crown className="h-3.5 w-3.5 text-amber-400" />
                            <span>Asignar Owner</span>
                          </Button>

                          {/* 2. Bypass / Configurar Plan */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPlanModalTenant(tenant);
                              setSelectedPlan(isPro ? "Pro" : "Free");
                              setAdditionalSeatsInput(additionalSeats);
                            }}
                            className="bg-zinc-950 border-2 border-zinc-700 hover:border-emerald-400 hover:text-emerald-300 font-mono text-xs font-semibold h-9 gap-1.5"
                            title="Activar Plan Pro de por vida o añadir asientos sin pasar por Stripe"
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-400" />
                            <span>Ajustar Plan</span>
                          </Button>

                          {/* 3. Auditar Espacio / Impersonate */}
                          <Button
                            size="sm"
                            onClick={() => handleImpersonateTenant(tenant.id)}
                            className="bg-white text-black hover:bg-zinc-200 border-2 border-black font-mono text-xs font-bold h-9 gap-1.5 shadow-[2px_2px_0px_0px_rgba(251,191,36,1)]"
                            title="Entrar al Cockpit con este Tenant para inspeccionar su calendario y átomos"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Auditar Espacio</span>
                          </Button>
                        </div>
                      </div>

                      {/* Miembros del Tenant con sus roles */}
                      {tenant.members && tenant.members.length > 0 && (
                        <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                          <div className="text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                            <span className="font-bold flex items-center gap-1">
                              <Users className="h-3 w-3 text-zinc-500" />
                              Equipo ({tenant.members.length}):
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {tenant.members.map((m) => (
                              <span
                                key={m.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono bg-zinc-950 border border-zinc-800 text-zinc-200"
                              >
                                <span>{m.email || m.displayName || m.id.substring(0, 8)}</span>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                                    m.role === "owner"
                                      ? "bg-amber-400 text-black font-extrabold"
                                      : m.role === "admin"
                                      ? "bg-blue-900/60 text-blue-300 border border-blue-600"
                                      : m.role === "operator"
                                      ? "bg-emerald-900/60 text-emerald-300 border border-emerald-600"
                                      : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                                  }`}
                                >
                                  {m.role}
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Datos de FinOps / Stripe vinculados al Tenant */}
                      {(tenant.stripe_customer_id || tenant.stripe_subscription_id) && (
                        <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between text-xs font-mono text-zinc-400 gap-2">
                          <div className="flex items-center gap-3">
                            <CreditCard className="h-3.5 w-3.5 text-zinc-500" />
                            <span>
                              Stripe Cust:{" "}
                              <code className="text-zinc-300">
                                {tenant.stripe_customer_id || tenant.stripeCustomerId || "N/A"}
                              </code>
                            </span>
                            <span>•</span>
                            <span>
                              Sub ID:{" "}
                              <code className="text-zinc-300">
                                {tenant.stripe_subscription_id || tenant.stripeSubscriptionId || "N/A"}
                              </code>
                            </span>
                          </div>
                          {tenant.stripe_customer_id && (
                            <a
                              href={`https://dashboard.stripe.com/customers/${tenant.stripe_customer_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-amber-400 hover:underline flex items-center gap-1"
                            >
                              <span>Ver en Stripe</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === "users" ? (
          /* TAB 2: DIRECTORIO GLOBAL DE USUARIOS */
          <div className="space-y-4">
            <div className="flex items-center justify-between font-mono text-xs text-zinc-400 px-1">
              <span>Directorio Completo de Cuentas ({filteredUsers.length})</span>
              <span>Haz clic en un UID para copiarlo y asignarlo como propietario</span>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed border-zinc-800 rounded-2xl font-mono text-zinc-500 text-sm">
                No se encontraron usuarios con "{searchQuery}".
              </div>
            ) : (
              <div className="bg-zinc-900 border-2 border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-zinc-950 text-zinc-400 border-b-2 border-zinc-800">
                      <tr>
                        <th className="p-3.5 font-bold">Email / Operario</th>
                        <th className="p-3.5 font-bold">UID de Firebase</th>
                        <th className="p-3.5 font-bold">Rol Global</th>
                        <th className="p-3.5 font-bold">Tenant Activo</th>
                        <th className="p-3.5 font-bold">Registro</th>
                        <th className="p-3.5 font-bold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {filteredUsers.map((u) => (
                        <tr key={u.uid} className="hover:bg-zinc-800/50 transition-colors">
                          <td className="p-3.5">
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{u.email}</span>
                              {isSuperAdminEmail(u.email) && (
                                <Badge className="bg-amber-400 text-black text-[9px] py-0 px-1 font-bold">
                                  SUPERADMIN
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-400">{u.displayName || "Sin nombre"}</div>
                          </td>

                          <td className="p-3.5">
                            <button
                              onClick={() => handleCopyUid(u.uid)}
                              className="inline-flex items-center gap-1.5 px-2 py-1 bg-zinc-950 border border-zinc-700 hover:border-amber-400 rounded text-zinc-300 text-[11px] font-mono group"
                              title="Copiar UID"
                            >
                              <span>{u.uid.substring(0, 16)}...</span>
                              {copiedUid === u.uid ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3 text-zinc-500 group-hover:text-amber-400" />
                              )}
                            </button>
                          </td>

                          <td className="p-3.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                u.role === "Pro User"
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-500"
                                  : "bg-zinc-800 text-zinc-300"
                              }`}
                            >
                              {u.role || "Free User"}
                            </span>
                          </td>

                          <td className="p-3.5">
                            {u.tenantId ? (
                              <button
                                onClick={() => handleImpersonateTenant(u.tenantId!)}
                                className="text-amber-400 hover:underline flex items-center gap-1"
                                title="Entrar en este tenant"
                              >
                                <span>{u.tenantId}</span>
                                <ExternalLink className="h-3 w-3" />
                              </button>
                            ) : (
                              <span className="text-zinc-600">No vinculado</span>
                            )}
                          </td>

                          <td className="p-3.5 text-zinc-400">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "N/A"}
                          </td>

                          <td className="p-3.5 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenRoleModal(u)}
                              className="bg-zinc-950 border-2 border-amber-500/70 hover:bg-amber-400 hover:text-black hover:border-amber-400 font-mono text-xs font-semibold h-8 gap-1.5 transition-all shadow-sm"
                              title="Cambiar rol (Owner, Admin, Operator, Viewer) o asignar a otra empresa"
                            >
                              <UserCheck className="h-3.5 w-3.5 text-amber-400 group-hover:text-black" />
                              <span>Gestionar Rol</span>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* TAB 3: FINOPS & STRIPE */
          <div className="space-y-6">
            <div className="bg-zinc-900 border-2 border-zinc-800 rounded-2xl p-6 space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-emerald-400" />
                    Pasarela Financiera Stripe (Producción & Pruebas)
                  </h3>
                  <p className="text-xs text-zinc-400 font-mono">
                    Control del túnel criptográfico, estado de webhook y cuentas de cliente
                  </p>
                </div>

                <a
                  href="https://dashboard.stripe.com"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-black hover:bg-emerald-400 font-mono text-xs font-bold rounded-xl shadow-md transition-all"
                >
                  <span>Abrir Stripe Dashboard</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2 font-mono text-xs">
                  <span className="text-zinc-400 font-bold uppercase">Escudo Criptográfico (Webhook)</span>
                  <p className="text-zinc-300">
                    Secreto activo:{" "}
                    <code className="text-emerald-400">whsec_84450af...</code>
                  </p>
                  <p className="text-zinc-500 text-[11px]">
                    Valida firmas HMAC-SHA256 en <code className="text-zinc-300">/api/webhooks</code> para
                    evitar ataques de falsificación de cuotas.
                  </p>
                </div>

                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2 font-mono text-xs">
                  <span className="text-zinc-400 font-bold uppercase">Comandos Tácticos Stripe CLI</span>
                  <p className="text-zinc-400">
                    Escuchar eventos en local:{" "}
                    <code className="text-amber-400 block p-1.5 bg-zinc-900 rounded mt-1 border border-zinc-800">
                      stripe listen --forward-to localhost:3000/api/webhooks
                    </code>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* MODAL 1: ASIGNAR / TRANSFERIR PROPIETARIO A UN TENANT            */}
        {/* ================================================================= */}
        {ownerModalTenant && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-900 border-2 border-amber-400 w-full max-w-lg rounded-2xl p-6 space-y-6 shadow-2xl font-mono">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-400" />
                    Asignar Propietario (Owner)
                  </h3>
                  <button
                    onClick={() => setOwnerModalTenant(null)}
                    className="text-zinc-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-zinc-400">
                  Espacio: <strong className="text-white">{ownerModalTenant.name}</strong> ({ownerModalTenant.id})
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-xs text-zinc-300 font-bold block">
                  Selecciona el usuario que será el Propietario Soberano:
                </label>

                <select
                  value={selectedNewOwnerUid}
                  onChange={(e) => setSelectedNewOwnerUid(e.target.value)}
                  className="w-full bg-zinc-950 border-2 border-zinc-700 text-xs font-mono text-zinc-100 p-2.5 rounded-xl focus:border-amber-400 outline-none"
                >
                  <option value="">-- Elige un usuario registrado --</option>
                  {data?.users?.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.email} ({u.displayName || "Sin nombre"}) - UID: {u.uid.substring(0, 8)}...
                    </option>
                  ))}
                </select>

                <p className="text-[11px] text-zinc-500">
                  O introduce manualmente el UID de Firebase Auth si es un usuario externo:
                </p>
                <Input
                  value={selectedNewOwnerUid}
                  onChange={(e) => setSelectedNewOwnerUid(e.target.value)}
                  placeholder="UID del usuario (ej: 4eY8g1JkLmNoP...)"
                  className="bg-zinc-950 border border-zinc-700 text-xs font-mono text-zinc-200"
                />

                <div className="p-3 bg-amber-950/40 border border-amber-500/50 rounded-xl text-[11px] text-amber-200 space-y-1">
                  <p className="font-bold">⚡ Efectos de esta mutación atómica:</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-zinc-300">
                    <li>
                      Actualiza <code className="text-amber-300">tenants/{ownerModalTenant.id}.ownerId</code>
                    </li>
                    <li>
                      Crea/actualiza el registro en{" "}
                      <code className="text-amber-300">members/{selectedNewOwnerUid}</code> con rol{" "}
                      <code className="text-white font-bold">owner</code>
                    </li>
                    <li>
                      El usuario tendrá acceso pleno a facturación, gestión de equipo y eliminación.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setOwnerModalTenant(null)}
                  disabled={isSubmittingOwner}
                  className="text-zinc-400 hover:text-white text-xs font-mono"
                >
                  Cancelar
                </Button>

                <Button
                  onClick={handleConfirmSetOwner}
                  disabled={!selectedNewOwnerUid || isSubmittingOwner}
                  className="bg-amber-400 text-black hover:bg-amber-300 border-2 border-black font-bold text-xs font-mono h-10 px-5"
                >
                  {isSubmittingOwner ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Guardando...
                    </>
                  ) : (
                    "Confirmar Asignación"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* MODAL 2: BYPASS PLAN PRO / MODIFICAR ASIENTOS                     */}
        {/* ================================================================= */}
        {planModalTenant && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-900 border-2 border-emerald-500 w-full max-w-lg rounded-2xl p-6 space-y-6 shadow-2xl font-mono">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <SlidersHorizontal className="h-5 w-5 text-emerald-400" />
                    Ajustar Plan & Asientos (Bypass)
                  </h3>
                  <button
                    onClick={() => setPlanModalTenant(null)}
                    className="text-zinc-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-zinc-400">
                  Espacio: <strong className="text-white">{planModalTenant.name}</strong>
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-300 font-bold block">Nivel de Plan:</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedPlan("Free")}
                      className={`p-3 rounded-xl border-2 text-xs font-mono font-bold flex flex-col items-center gap-1 transition-all ${
                        selectedPlan === "Free"
                          ? "bg-zinc-800 border-white text-white"
                          : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                      }`}
                    >
                      <span>Free Tier</span>
                      <span className="text-[10px] font-normal text-zinc-400">Sin funciones Pro</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedPlan("Pro")}
                      className={`p-3 rounded-xl border-2 text-xs font-mono font-bold flex flex-col items-center gap-1 transition-all ${
                        selectedPlan === "Pro"
                          ? "bg-emerald-950/70 border-emerald-400 text-emerald-200"
                          : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <Zap className="h-3.5 w-3.5 text-emerald-400" />
                        Plan Pro
                      </span>
                      <span className="text-[10px] font-normal text-emerald-400/80">Acceso Ilimitado</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-300 font-bold block">
                    Asientos adicionales asignados (Add-on Seats):
                  </label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={additionalSeatsInput}
                      onChange={(e) => setAdditionalSeatsInput(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="bg-zinc-950 border-2 border-zinc-700 text-white font-mono text-sm w-28 text-center"
                    />
                    <span className="text-xs text-zinc-400">usuarios de campo extra autorizados</span>
                  </div>
                </div>

                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-[11px] text-zinc-400">
                  <p>
                    💡 Esta acción actualiza directamente el documento del Tenant en Firestore. Los
                    operarios del espacio obtendrán acceso inmediato a las funciones avanzadas sin requerir
                    tarjeta de crédito.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setPlanModalTenant(null)}
                  disabled={isSubmittingPlan}
                  className="text-zinc-400 hover:text-white text-xs font-mono"
                >
                  Cancelar
                </Button>

                <Button
                  onClick={handleConfirmSetPlan}
                  disabled={isSubmittingPlan}
                  className="bg-emerald-500 text-black hover:bg-emerald-400 border-2 border-black font-bold text-xs font-mono h-10 px-5"
                >
                  {isSubmittingPlan ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Aplicando...
                    </>
                  ) : (
                    "Guardar Plan"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* MODAL 3: MODIFICAR ROL DE USUARIO Y ESPACIO                       */}
        {/* ================================================================= */}
        {roleModalUser && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-900 border-2 border-amber-400 w-full max-w-lg rounded-2xl p-6 space-y-6 shadow-2xl font-mono">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-amber-400" />
                    Gestionar Rol y Organización
                  </h3>
                  <button
                    onClick={() => setRoleModalUser(null)}
                    className="text-zinc-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-zinc-400">
                  Usuario: <strong className="text-white">{roleModalUser.email}</strong> ({roleModalUser.displayName || "Sin nombre"})
                </p>
                <p className="text-[11px] text-zinc-500">
                  UID: <code>{roleModalUser.uid}</code>
                </p>
              </div>

              <div className="space-y-4">
                {/* 1. SELECCIONAR ESPACIO DE TRABAJO */}
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-300 font-bold block">
                    Espacio de Trabajo (Tenant):
                  </label>
                  <select
                    value={selectedRoleTenantId}
                    onChange={(e) => handleTenantSelectChange(e.target.value)}
                    className="w-full bg-zinc-950 border-2 border-zinc-700 text-xs font-mono text-zinc-100 p-2.5 rounded-xl focus:border-amber-400 outline-none"
                  >
                    {data?.tenants?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name || "Sin nombre"} (ID: {t.id})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. SELECCIONAR ROL */}
                <div className="space-y-2">
                  <label className="text-xs text-zinc-300 font-bold block">
                    Rol en este Espacio de Trabajo:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      {
                        role: "owner" as TenantRole,
                        label: "👑 Propietario (Owner)",
                        desc: "Control total, FinOps, compra de licencias Stripe",
                        color: "border-amber-400 bg-amber-950/40 text-amber-200",
                      },
                      {
                        role: "admin" as TenantRole,
                        label: "🛡️ Administrador",
                        desc: "Gestión de equipo, obras y configuración",
                        color: "border-blue-500 bg-blue-950/40 text-blue-200",
                      },
                      {
                        role: "operator" as TenantRole,
                        label: "👷 Operario",
                        desc: "Trabajo en obra, albaranes, omnibarra",
                        color: "border-emerald-500 bg-emerald-950/40 text-emerald-200",
                      },
                      {
                        role: "viewer" as TenantRole,
                        label: "👁️ Lector (Viewer)",
                        desc: "Solo lectura, sin permisos de mutación",
                        color: "border-zinc-500 bg-zinc-800 text-zinc-200",
                      },
                    ].map((item) => (
                      <button
                        key={item.role}
                        type="button"
                        onClick={() => setSelectedRole(item.role)}
                        className={`p-3 rounded-xl border-2 text-left font-mono transition-all flex flex-col gap-1 ${
                          selectedRole === item.role
                            ? item.color
                            : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                        }`}
                      >
                        <span className="font-bold text-xs">{item.label}</span>
                        <span className="text-[10px] text-zinc-400 leading-tight">
                          {item.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. SELECCIONAR ROL GLOBAL */}
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-300 font-bold block">
                    Rol Global en Plataforma:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedGlobalRole("Free User")}
                      className={`p-2.5 rounded-xl border-2 text-xs font-mono font-bold text-center transition-all ${
                        selectedGlobalRole === "Free User"
                          ? "bg-zinc-800 border-white text-white"
                          : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                      }`}
                    >
                      Free User
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedGlobalRole("Pro User")}
                      className={`p-2.5 rounded-xl border-2 text-xs font-mono font-bold text-center transition-all ${
                        selectedGlobalRole === "Pro User"
                          ? "bg-emerald-950/70 border-emerald-400 text-emerald-200"
                          : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                      }`}
                    >
                      Pro User
                    </button>
                  </div>
                </div>

                {selectedRole === "owner" && (
                  <div className="p-3 bg-amber-950/40 border border-amber-500/50 rounded-xl text-[11px] text-amber-200 space-y-1">
                    <p className="font-bold">⚡ Efectos de promocionar a Propietario (Owner):</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-zinc-300">
                      <li>El usuario será el <code className="text-amber-300">ownerId</code> del espacio.</li>
                      <li>Desbloqueará la compra de asientos en Stripe y la facturación.</li>
                      <li>Si había otro propietario previo, quedará degradado a Administrador de forma segura.</li>
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setRoleModalUser(null)}
                  disabled={isSubmittingRole}
                  className="text-zinc-400 hover:text-white text-xs font-mono"
                >
                  Cancelar
                </Button>

                <Button
                  onClick={handleConfirmSetRole}
                  disabled={isSubmittingRole}
                  className="bg-amber-400 text-black hover:bg-amber-300 border-2 border-black font-bold text-xs font-mono h-10 px-5 shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
                >
                  {isSubmittingRole ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Guardando...
                    </>
                  ) : (
                    "Guardar Rol"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
