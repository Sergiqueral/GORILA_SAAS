import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/superadmin-server';
import { firestore, getFirestoreDb } from '@/firebase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
    const { tenantId, newOwnerUid } = body;

    if (!tenantId || !newOwnerUid) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos: tenantId y newOwnerUid' },
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

    // Buscar datos del nuevo propietario
    const newOwnerRef = db.collection('users').doc(newOwnerUid);
    const newOwnerDoc = await newOwnerRef.get();

    const newOwnerData = newOwnerDoc.exists ? newOwnerDoc.data() || {} : {};
    const newOwnerEmail = newOwnerData.email || 'operario@gorila.saas';
    const newOwnerName = newOwnerData.displayName || newOwnerEmail.split('@')[0];

    const batch = db.batch();

    // 1. Actualizar ownerId en el documento del Tenant
    batch.update(tenantRef, {
      ownerId: newOwnerUid,
      updatedAt: Date.now(),
    });

    // 2. Si había un owner previo diferente, degradarlo a admin dentro del equipo
    if (oldOwnerId && oldOwnerId !== newOwnerUid) {
      const oldMemberRef = tenantRef.collection('members').doc(oldOwnerId);
      const oldMemberDoc = await oldMemberRef.get();
      if (oldMemberDoc.exists) {
        batch.update(oldMemberRef, {
          role: 'admin',
          updatedAt: Date.now(),
        });
      }
    }

    // 3. Establecer el registro de membresía del nuevo owner con rol 'owner'
    const newMemberRef = tenantRef.collection('members').doc(newOwnerUid);
    batch.set(
      newMemberRef,
      {
        role: 'owner',
        status: 'active',
        email: newOwnerEmail,
        displayName: newOwnerName,
        joinedAt: Date.now(),
      },
      { merge: true }
    );

    // 4. Asegurar que el usuario tenga este tenantId asociado en su perfil
    if (newOwnerDoc.exists) {
      batch.update(newOwnerRef, {
        tenantId: tenantId,
        updatedAt: Date.now(),
      });
    }

    await batch.commit();

    console.log(
      `[SuperAdmin] Propiedad transferida en ${tenantId}: nuevo owner=${newOwnerUid} (${newOwnerEmail}), owner anterior=${oldOwnerId}`
    );

    return NextResponse.json({
      success: true,
      message: `Propiedad del espacio ${tenantId} transferida con éxito a ${newOwnerEmail}`,
      tenantId,
      newOwnerUid,
      newOwnerEmail,
    });
  } catch (err: any) {
    console.error('[SuperAdmin Set-Owner] Error en transferencia de propiedad:', err);
    return NextResponse.json(
      { error: err?.message || 'Error al transferir la propiedad del tenant' },
      { status: 500 }
    );
  }
}
