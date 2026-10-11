"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/firebase/config";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { Tenant, TenantMember, TenantRole, UserProfile } from "@/types/tenant";

export function useTenant() {
  const { user, loading: authLoading } = useAuth();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [currentRole, setCurrentRole] = useState<TenantRole>("viewer");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar perfil del usuario y su organización activa
  const loadTenantData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. Obtener o crear perfil de usuario
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      let profileData: UserProfile;

      if (!userSnap.exists()) {
        const defaultTenantId = `tenant_${user.uid}`;
        profileData = {
          email: user.email || "",
          displayName: user.displayName || user.email?.split("@")[0] || "Operario",
          photoURL: user.photoURL || undefined,
          role: "Free User",
          tenantId: defaultTenantId,
          createdAt: Date.now(),
        };
        try {
          await setDoc(userRef, profileData);
        } catch (e) {
          console.warn("No se pudo persistir el usuario en Firestore:", e);
        }
      } else {
        profileData = userSnap.data() as UserProfile;
      }
      setUserProfile(profileData);

      // 2. Resolver el Tenant ID (priorizando selección activa en localStorage, perfil, o por defecto tenant_{uid})
      const savedTenant = typeof window !== "undefined" ? localStorage.getItem("gorila_active_tenant") : null;
      const targetTenantId =
        savedTenant ||
        profileData.tenantId ||
        `tenant_${user.uid}`;

      // 3. Obtener datos de la empresa (Tenant)
      const tenantRef = doc(db, "tenants", targetTenantId);
      const tenantSnap = await getDoc(tenantRef);

      if (tenantSnap.exists()) {
        const tenantData = { id: tenantSnap.id, ...tenantSnap.data() } as Tenant;
        setTenant(tenantData);

        // 4. Obtener miembros de la organización
        const membersRef = collection(db, `tenants/${targetTenantId}/members`);
        const membersSnap = await getDocs(membersRef);
        const memberList: TenantMember[] = [];

        membersSnap.forEach((mDoc) => {
          memberList.push({ id: mDoc.id, ...mDoc.data() } as TenantMember);
        });

        setMembers(memberList);

        // 5. Determinar el rol del usuario en la organización
        if (tenantData.ownerId === user.uid) {
          setCurrentRole("owner");
        } else {
          const myMemberRecord = memberList.find((m) => m.id === user.uid);
          setCurrentRole(myMemberRecord?.role || "viewer");
        }
      } else {
        // El tenant aún no existe físicamente en Firestore (requiere bootstrap inicial)
        const placeholderTenant: Tenant = {
          id: targetTenantId,
          name: "Mi Organización",
          ownerId: user.uid,
          plan: "Free",
          createdAt: Date.now(),
        };
        setTenant(placeholderTenant);
        setCurrentRole("owner");
        setMembers([
          {
            id: user.uid,
            email: user.email || "",
            displayName: profileData.displayName || "Propietario",
            role: "owner",
            status: "active",
            joinedAt: Date.now(),
          },
        ]);
      }
    } catch (err: any) {
      console.error("Error al cargar datos del Tenant:", err);
      setError(err?.message || "Error al sincronizar con la organización");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      loadTenantData();
    }
  }, [authLoading, loadTenantData]);

  // Inicializar organización (Bootstrapping Fricción Cero en 1 clic)
  const bootstrapTenant = async (companyName: string, cif?: string) => {
    if (!user) return;
    const targetTenantId = `tenant_${user.uid}`;

    const newTenantData: Omit<Tenant, "id"> = {
      name: companyName.trim() || "Mi Organización",
      ownerId: user.uid,
      plan: "Free",
      cif: cif?.trim() || "",
      createdAt: Date.now(),
    };

    const initialMember: Omit<TenantMember, "id"> = {
      email: user.email || "",
      displayName: userProfile?.displayName || user.email?.split("@")[0] || "Propietario",
      role: "owner",
      status: "active",
      joinedAt: Date.now(),
    };

    // Actualización optimista local
    setTenant({ id: targetTenantId, ...newTenantData });
    setCurrentRole("owner");
    setMembers([{ id: user.uid, ...initialMember }]);

    try {
      // 1. Crear documento de Tenant
      await setDoc(doc(db, "tenants", targetTenantId), newTenantData);

      // 2. Crear membership como propietario
      await setDoc(doc(db, `tenants/${targetTenantId}/members`, user.uid), initialMember);

      // 3. Vincular al perfil de usuario
      await updateDoc(doc(db, "users", user.uid), {
        tenantId: targetTenantId,
        updatedAt: Date.now(),
      });

      localStorage.setItem("gorila_active_tenant", targetTenantId);
    } catch (e: any) {
      console.error("Error en bootstrap del Tenant:", e);
      throw new Error(e?.message || "Error al inicializar la organización");
    }
  };

  // Actualizar configuración de la empresa
  const updateTenant = async (data: Partial<Tenant>) => {
    if (!tenant || !user) return;

    const updatedTenant: Tenant = {
      ...tenant,
      ...data,
      updatedAt: Date.now(),
    };

    // Optimistic UI
    setTenant(updatedTenant);

    try {
      const tenantRef = doc(db, "tenants", tenant.id);
      await updateDoc(tenantRef, {
        ...(data.name && { name: data.name }),
        ...(data.cif !== undefined && { cif: data.cif }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.address !== undefined && { address: data.address }),
        updatedAt: Date.now(),
      });
    } catch (e: any) {
      console.error("Error al actualizar empresa:", e);
      // Revertir en caso de error
      loadTenantData();
      throw new Error(e?.message || "No tienes permisos para modificar los datos de la empresa");
    }
  };

  // Actualizar perfil del usuario
  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!user || !userProfile) return;

    const updatedProfile: UserProfile = {
      ...userProfile,
      ...data,
      updatedAt: Date.now(),
    };

    setUserProfile(updatedProfile);

    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.photoURL !== undefined && { photoURL: data.photoURL }),
        ...(data.tenantId !== undefined && { tenantId: data.tenantId }),
        updatedAt: Date.now(),
      });
    } catch (e: any) {
      console.error("Error al actualizar perfil:", e);
      throw new Error(e?.message || "Error al actualizar perfil de usuario");
    }
  };

  // Invitar a un nuevo miembro al equipo
  const inviteMember = async (email: string, role: TenantRole, displayName?: string) => {
    if (!tenant || !user) throw new Error("No hay organización activa");
    if (!email || !email.includes("@")) throw new Error("Email no válido");

    const cleanEmail = email.trim().toLowerCase();

    // Comprobar si ya existe
    if (members.some((m) => m.email.toLowerCase() === cleanEmail)) {
      throw new Error("Este usuario ya es miembro o tiene una invitación pendiente");
    }

    const memberId = `member_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newMember: TenantMember = {
      id: memberId,
      email: cleanEmail,
      displayName: displayName?.trim() || cleanEmail.split("@")[0],
      role,
      status: "pending",
      joinedAt: Date.now(),
      invitedBy: user.uid,
    };

    // UI Optimista instantánea (< 100ms)
    setMembers((prev) => [...prev, newMember]);

    try {
      const memberRef = doc(db, `tenants/${tenant.id}/members`, memberId);
      await setDoc(memberRef, {
        email: newMember.email,
        displayName: newMember.displayName,
        role: newMember.role,
        status: newMember.status,
        joinedAt: newMember.joinedAt,
        invitedBy: newMember.invitedBy,
      });
    } catch (e: any) {
      console.error("Error al registrar invitación:", e);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      throw new Error(e?.message || "Error al invitar al miembro. Comprueba tus permisos de Administrador.");
    }
  };

  // Cambiar rol de un miembro
  const updateMemberRole = async (memberId: string, newRole: TenantRole) => {
    if (!tenant || !user) return;

    const previous = [...members];
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    );

    try {
      const memberRef = doc(db, `tenants/${tenant.id}/members`, memberId);
      await updateDoc(memberRef, { role: newRole });
    } catch (e: any) {
      console.error("Error al cambiar rol:", e);
      setMembers(previous);
      throw new Error(e?.message || "No tienes permisos para modificar el rol de este miembro.");
    }
  };

  // Eliminar o revocar miembro
  const removeMember = async (memberId: string) => {
    if (!tenant || !user) return;

    const memberToRemove = members.find((m) => m.id === memberId);
    if (memberToRemove?.role === "owner") {
      throw new Error("El propietario de la organización no puede ser eliminado");
    }

    const previous = [...members];
    setMembers((prev) => prev.filter((m) => m.id !== memberId));

    try {
      const memberRef = doc(db, `tenants/${tenant.id}/members`, memberId);
      await deleteDoc(memberRef);
    } catch (e: any) {
      console.error("Error al eliminar miembro:", e);
      setMembers(previous);
      throw new Error(e?.message || "No tienes permisos para eliminar a este miembro.");
    }
  };

  // Cambiar rápidamente de espacio de trabajo / organización
  const switchTenant = (tenantId: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("gorila_active_tenant", tenantId);
      loadTenantData();
    }
  };

  return {
    user,
    userProfile,
    tenant,
    members,
    currentRole,
    isOwner: currentRole === "owner",
    isAdmin: currentRole === "owner" || currentRole === "admin",
    isOperator: currentRole === "owner" || currentRole === "admin" || currentRole === "operator",
    loading: authLoading || loading,
    error,
    refreshTenant: loadTenantData,
    switchTenant,
    bootstrapTenant,
    updateTenant,
    updateUserProfile,
    inviteMember,
    updateMemberRole,
    removeMember,
  };
}
