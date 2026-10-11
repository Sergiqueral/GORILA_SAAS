import "@/lib/server-polyfill";
import { NextRequest, NextResponse } from 'next/server';
import { verifyUserAuth } from '@/lib/auth-server';
import { firestore } from '@/firebase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Endpoint de Bootstrapping y Soberanía de Identidad (Gorila Codex).
 * 
 * Regla de Oro:
 * Cuando un usuario se registra o accede por primera vez sin una invitación previa,
 * el sistema lo provisiona FÍSICAMENTE en Firestore como PROPIETARIO (role: 'owner')
 * de su propia organización (tenants/tenant_{uid}) con Fricción Cero.
 * 
 * Si tiene una invitación pendiente de un Tenant existente, se le vincula a dicho
 * Tenant con el rol especificado por el administrador que lo invitó.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyUserAuth(req);
    if (!authResult.authenticated || !authResult.uid) {
      return NextResponse.json(
        { error: authResult.error || 'Autenticación requerida' },
        { status: 401 }
      );
    }

    if (!firestore) {
      return NextResponse.json(
        { error: 'Firebase Admin Firestore no está inicializado en el servidor.' },
        { status: 503 }
      );
    }

    const { uid } = authResult;
    const email = (authResult.email || '').toLowerCase().trim();
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body opcional (puede enviarse vacío)
    }

    const displayName = body.displayName || authResult.displayName || (email ? email.split('@')[0] : 'Operario');
    const companyName = body.companyName?.trim() || 'Mi Organización';
    const cif = body.cif?.trim() || '';

    const userRef = firestore.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() : null;

    // 1. Si el usuario ya tiene un tenant asociado, verificar y auto-reparar si es necesario
    if (userData?.tenantId) {
      const existingTenantId = userData.tenantId;
      const tenantRef = firestore.collection('tenants').doc(existingTenantId);
      const tenantSnap = await tenantRef.get();

      if (tenantSnap.exists) {
        const tenantData = tenantSnap.data()!;
        const memberRef = tenantRef.collection('members').doc(uid);
        const memberSnap = await memberRef.get();

        const isOwner = tenantData.ownerId === uid;

        if (!memberSnap.exists) {
          // Auto-reparar membresía faltante
          await memberRef.set({
            role: isOwner ? 'owner' : 'operator',
            email: email || userData.email || '',
            displayName: displayName || userData.displayName || 'Operario',
            status: 'active',
            joinedAt: Date.now(),
          });
        }

        const role = isOwner ? 'owner' : (memberSnap.data()?.role || 'operator');

        return NextResponse.json({
          success: true,
          isOwner,
          role,
          tenantId: existingTenantId,
          isNewWorkspace: false,
          tenantName: tenantData.name || 'Mi Organización',
        });
      }
    }

    const invitedTenantId = typeof body.invitedTenantId === 'string' ? body.invitedTenantId.trim() : '';

    // 2. Comprobar si el usuario tiene una invitación pendiente
    let pendingInvite: {
      tenantId: string;
      role: string;
      inviteDocId: string;
      invitedBy?: string;
    } | null = null;

    if (email) {
      // 2.1 Si se proporcionó un tenantId específico (enlace de invitación directo)
      if (invitedTenantId) {
        try {
          const specificInvites = await firestore
            .collection('tenants')
            .doc(invitedTenantId)
            .collection('members')
            .where('email', '==', email)
            .where('status', '==', 'pending')
            .limit(1)
            .get();

          if (!specificInvites.empty) {
            const inviteDoc = specificInvites.docs[0];
            const inviteData = inviteDoc.data();
            pendingInvite = {
              tenantId: invitedTenantId,
              role: inviteData.role || 'operator',
              inviteDocId: inviteDoc.id,
              invitedBy: inviteData.invitedBy,
            };
          }
        } catch (specificErr) {
          console.warn(`[Bootstrap Auth] No se pudo consultar invitación en tenant específico ${invitedTenantId}:`, specificErr);
        }
      }

      // 2.2 Si aún no se encontró, buscar en collectionGroup global
      if (!pendingInvite) {
        try {
          const invitesQuery = await firestore
            .collectionGroup('members')
            .where('email', '==', email)
            .where('status', '==', 'pending')
            .limit(1)
            .get();

          if (!invitesQuery.empty) {
            const inviteDoc = invitesQuery.docs[0];
            const inviteData = inviteDoc.data();
            const parentTenantRef = inviteDoc.ref.parent.parent;

            if (parentTenantRef) {
              pendingInvite = {
                tenantId: parentTenantRef.id,
                role: inviteData.role || 'operator',
                inviteDocId: inviteDoc.id,
                invitedBy: inviteData.invitedBy,
              };
            }
          }
        } catch (inviteQueryErr) {
          console.warn('[Bootstrap Auth] No se pudo consultar invitaciones pendientes via collectionGroup:', inviteQueryErr);
        }
      }
    }

    // CASO A: Usuario con invitación previa activa -> Unirse al Tenant anfitrión
    if (pendingInvite) {
      const { tenantId: hostTenantId, role: invitedRole, inviteDocId, invitedBy } = pendingInvite;
      const batch = firestore.batch();

      // 1. Crear registro de miembro con el UID real del usuario
      const memberRef = firestore.collection('tenants').doc(hostTenantId).collection('members').doc(uid);
      batch.set(
        memberRef,
        {
          role: invitedRole,
          email,
          displayName,
          status: 'active',
          joinedAt: Date.now(),
          ...(invitedBy ? { invitedBy } : {}),
        },
        { merge: true }
      );

      // 2. Si el doc de invitación tenía un ID temporal diferente, eliminarlo
      if (inviteDocId !== uid) {
        const oldInviteRef = firestore.collection('tenants').doc(hostTenantId).collection('members').doc(inviteDocId);
        batch.delete(oldInviteRef);
      }

      // 3. Actualizar perfil de usuario
      batch.set(
        userRef,
        {
          email,
          displayName,
          role: 'Free User',
          tenantId: hostTenantId,
          createdAt: userData?.createdAt || Date.now(),
          updatedAt: Date.now(),
        },
        { merge: true }
      );

      await batch.commit();

      console.log(`[Bootstrap Auth] Usuario ${email} (${uid}) incorporado a tenant anfitrión ${hostTenantId} con rol ${invitedRole}`);

      return NextResponse.json({
        success: true,
        isOwner: false,
        role: invitedRole,
        tenantId: hostTenantId,
        isNewWorkspace: false,
      });
    }

    // CASO B: Usuario NO invitado (Registro por primera vez) -> PROPIETARIO SOBERANO (Owner)
    const newTenantId = `tenant_${uid}`;
    const newTenantRef = firestore.collection('tenants').doc(newTenantId);
    const newMemberRef = newTenantRef.collection('members').doc(uid);

    const batch = firestore.batch();

    // 1. Crear documento raíz del Tenant en Firestore
    batch.set(
      newTenantRef,
      {
        name: companyName,
        ownerId: uid,
        plan: 'Free',
        cif: cif || '',
        email: email || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    // 2. Crear documento de Membresía como Owner en el subcollection members
    batch.set(
      newMemberRef,
      {
        role: 'owner',
        email,
        displayName,
        status: 'active',
        joinedAt: Date.now(),
      },
      { merge: true }
    );

    // 3. Crear/actualizar documento de Usuario
    batch.set(
      userRef,
      {
        email,
        displayName,
        role: 'Free User',
        tenantId: newTenantId,
        createdAt: userData?.createdAt || Date.now(),
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    await batch.commit();

    console.log(`[Bootstrap Auth] Nuevo propietario aprovisionado: ${email} (${uid}) -> ${newTenantId} [role: owner]`);

    return NextResponse.json({
      success: true,
      isOwner: true,
      role: 'owner',
      tenantId: newTenantId,
      isNewWorkspace: true,
      tenantName: companyName,
    });
  } catch (err: any) {
    console.error('[Bootstrap Auth] Error crítico al aprovisionar workspace:', err);
    return NextResponse.json(
      { error: err?.message || 'Error interno al inicializar espacio de trabajo' },
      { status: 500 }
    );
  }
}
