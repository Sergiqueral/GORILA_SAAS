import { User } from 'firebase/auth';
import { db } from '@/firebase/config';
import { doc, getDoc, writeBatch } from 'firebase/firestore';

export interface BootstrapResult {
  success: boolean;
  isOwner: boolean;
  role: string;
  tenantId: string;
  isNewWorkspace: boolean;
}

/**
 * Garantiza de forma soberana e inmutable que un usuario cuente con un Espacio de Trabajo
 * físico en Firestore.
 * 
 * Regla Gorila Codex:
 * Si un usuario se registra por primera vez y no proviene de una invitación pendiente,
 * se crea físicamente como PROPIETARIO (role: 'owner') de su organización (tenants/tenant_{uid}).
 * 
 * Estrategia:
 * 1. Invoca /api/auth/bootstrap (Server con Firebase Admin SDK, verifica invitaciones cross-tenant).
 * 2. Fallback de alta disponibilidad en cliente con Firebase Client SDK.
 */
export interface EnsureWorkspaceOptions {
  companyName?: string;
  cif?: string;
  displayName?: string;
  invitedTenantId?: string;
}

/**
 * Garantiza de forma soberana e inmutable que un usuario cuente con un Espacio de Trabajo
 * físico en Firestore.
 * 
 * Regla Gorila Codex:
 * Si un usuario se registra por primera vez y no proviene de una invitación pendiente,
 * se crea físicamente como PROPIETARIO (role: 'owner') de su organización (tenants/tenant_{uid}).
 * 
 * Estrategia:
 * 1. Invoca /api/auth/bootstrap (Server con Firebase Admin SDK, verifica invitaciones cross-tenant).
 * 2. Fallback de alta disponibilidad en cliente con Firebase Client SDK.
 */
export async function ensureUserWorkspace(
  user: User,
  options?: EnsureWorkspaceOptions
): Promise<BootstrapResult> {
  const cleanEmail = (user.email || '').toLowerCase().trim();
  const displayName = options?.displayName || user.displayName || (cleanEmail ? cleanEmail.split('@')[0] : 'Operario');

  // 1. Intentar bootstrap mediante API del servidor (/api/auth/bootstrap)
  try {
    const idToken = await user.getIdToken();
    const res = await fetch('/api/auth/bootstrap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        companyName: options?.companyName || 'Mi Organización',
        cif: options?.cif || '',
        displayName,
        invitedTenantId: options?.invitedTenantId || '',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (typeof window !== 'undefined' && data.tenantId) {
        localStorage.setItem('gorila_active_tenant', data.tenantId);
      }
      return {
        success: true,
        isOwner: !!data.isOwner,
        role: data.role || (data.isOwner ? 'owner' : 'operator'),
        tenantId: data.tenantId,
        isNewWorkspace: !!data.isNewWorkspace,
      };
    } else {
      console.warn('[Workspace Bootstrap] Servidor devolvió estado:', res.status);
    }
  } catch (apiErr) {
    console.warn('[Workspace Bootstrap] Error de conexión con /api/auth/bootstrap, usando fallback directo:', apiErr);
  }

  // 2. Fallback resiliente en cliente con Firebase Client SDK (Respetando firestore.rules)
  const targetTenantId = `tenant_${user.uid}`;
  try {
    const batch = writeBatch(db);
    const now = Date.now();

    const tenantRef = doc(db, 'tenants', targetTenantId);
    const tenantSnap = await getDoc(tenantRef);

    if (!tenantSnap.exists()) {
      batch.set(tenantRef, {
        name: options?.companyName || 'Mi Organización',
        ownerId: user.uid,
        plan: 'Free',
        cif: options?.cif || '',
        email: cleanEmail,
        createdAt: now,
      });

      const memberRef = doc(db, `tenants/${targetTenantId}/members`, user.uid);
      batch.set(memberRef, {
        role: 'owner',
        email: cleanEmail,
        displayName,
        status: 'active',
        joinedAt: now,
      });

      const userRef = doc(db, 'users', user.uid);
      batch.set(
        userRef,
        {
          email: cleanEmail,
          displayName,
          role: 'Free User',
          tenantId: targetTenantId,
          createdAt: now,
        },
        { merge: true }
      );

      await batch.commit();

      if (typeof window !== 'undefined') {
        localStorage.setItem('gorila_active_tenant', targetTenantId);
      }

      return {
        success: true,
        isOwner: true,
        role: 'owner',
        tenantId: targetTenantId,
        isNewWorkspace: true,
      };
    } else {
      const tenantData = tenantSnap.data();
      const isOwner = tenantData?.ownerId === user.uid;

      if (typeof window !== 'undefined') {
        localStorage.setItem('gorila_active_tenant', targetTenantId);
      }

      return {
        success: true,
        isOwner,
        role: isOwner ? 'owner' : 'operator',
        tenantId: targetTenantId,
        isNewWorkspace: false,
      };
    }
  } catch (clientErr) {
    console.error('[Workspace Bootstrap] Error en fallback de cliente:', clientErr);
    return {
      success: false,
      isOwner: true,
      role: 'owner',
      tenantId: targetTenantId,
      isNewWorkspace: false,
    };
  }
}
