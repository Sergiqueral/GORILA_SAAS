import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/superadmin-server';
import { firestore, getFirestoreDb } from '@/firebase/admin';
import { TenantRole } from '@/types/tenant';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Endpoint de Mutación de Roles de SuperAdmin (God Mode).
 * 
 * Permite cambiar el rol de cualquier usuario dentro de un Tenant:
 * - 'owner': Transfiere soberanamente la propiedad de la empresa, actualizando ownerId y otorgando acceso total.
 * - 'admin': Habilita administración de equipo y ajustes.
 * - 'operator': Habilita trabajo de campo de alta velocidad (omnibarra, calendario, entidades).
 * - 'viewer': Modo solo lectura (sin mutaciones ni facturación).
 * 
 * Opcionalmente actualiza el rol global del usuario ('Free User' o 'Pro User').
 */
export async function POST(req: Request) {
  try {
    const auth = await verifySuperAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'No autorizado' }, { status: 403 });
    }

    const db = getFirestoreDb() || firestore;
    if (!db) {
      return NextResponse.json(
        { error: 'Firebase Admin SDK no está disponible en el servidor' },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { tenantId, uid, role, globalRole } = body as {
      tenantId: string;
      uid: string;
      role: TenantRole;
      globalRole?: string;
    };

    if (!tenantId || !uid || !role) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos: tenantId, uid y role' },
        { status: 400 }
      );
    }

    const validRoles: TenantRole[] = ['owner', 'admin', 'operator', 'viewer'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Rol no válido: ${role}. Debe ser uno de: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    const tenantRef = db.collection('tenants').doc(tenantId);
    const tenantDoc = await tenantRef.get();

    if (!tenantDoc.exists) {
      return NextResponse.json(
        { error: `El espacio de trabajo ${tenantId} no existe` },
        { status: 404 }
      );
    }

    const tenantData = tenantDoc.data() || {};
    const oldOwnerId = tenantData.ownerId;

    // Obtener datos del usuario
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() || {} : {};
    const userEmail = userData.email || '';
    const userName = userData.displayName || (userEmail ? userEmail.split('@')[0] : 'Operario');

    const batch = db.batch();

    // 1. Si se le asigna rol 'owner', actualizar la propiedad soberana del tenant
    if (role === 'owner') {
      batch.update(tenantRef, {
        ownerId: uid,
        updatedAt: Date.now(),
      });

      // Si había un dueño previo distinto, degradarlo a admin dentro del equipo
      if (oldOwnerId && oldOwnerId !== uid) {
        const oldMemberRef = tenantRef.collection('members').doc(oldOwnerId);
        const oldMemberDoc = await oldMemberRef.get();
        if (oldMemberDoc.exists) {
          batch.update(oldMemberRef, {
            role: 'admin',
            updatedAt: Date.now(),
          });
        }
      }
    }

    // 2. Crear o actualizar el registro de miembro en la subcolección members
    const memberRef = tenantRef.collection('members').doc(uid);
    const memberDoc = await memberRef.get();

    batch.set(
      memberRef,
      {
        role,
        email: userEmail || memberDoc.data()?.email || '',
        displayName: userName || memberDoc.data()?.displayName || 'Operario',
        status: 'active',
        joinedAt: memberDoc.exists ? memberDoc.data()?.joinedAt || Date.now() : Date.now(),
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    // 3. Actualizar el perfil del usuario (tenantId activo y opcionalmente rol global)
    if (userDoc.exists) {
      const userUpdates: Record<string, any> = {
        tenantId,
        updatedAt: Date.now(),
      };
      if (globalRole) {
        userUpdates.role = globalRole;
      }
      batch.update(userRef, userUpdates);
    }

    await batch.commit();

    console.log(
      `[SuperAdmin] Rol actualizado en ${tenantId}: usuario ${userEmail} (${uid}) -> rol: ${role}`
    );

    return NextResponse.json({
      success: true,
      message: `Rol de ${userEmail || uid} actualizado a "${role}" en el espacio ${tenantData.name || tenantId}`,
      tenantId,
      uid,
      role,
      globalRole,
    });
  } catch (err: any) {
    console.error('[SuperAdmin Set-Role] Error al actualizar rol:', err);
    return NextResponse.json(
      { error: err?.message || 'Error al actualizar rol del usuario' },
      { status: 500 }
    );
  }
}
