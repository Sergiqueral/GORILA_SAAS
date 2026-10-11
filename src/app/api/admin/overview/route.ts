import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/superadmin-server';
import { firestore } from '@/firebase/admin';
import { Tenant, UserProfile, TenantMember } from '@/types/tenant';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const auth = await verifySuperAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'No autorizado' }, { status: 403 });
    }

    if (!firestore) {
      return NextResponse.json(
        {
          error: 'FIREBASE_ADMIN_NOT_CONFIGURED',
          message:
            'Firebase Admin SDK no está inicializado en el servidor. Configura FIREBASE_ADMIN_CLIENT_EMAIL y FIREBASE_ADMIN_PRIVATE_KEY en tu .env.local para habilitar el backend God Mode completo.',
          isConfigured: false,
        },
        { status: 503 }
      );
    }

    // 1. Obtener todos los espacios de trabajo (tenants)
    const tenantsSnap = await firestore.collection('tenants').get();
    const tenants: (Tenant & { membersCount?: number; ownerEmail?: string })[] = [];

    // 2. Obtener todos los usuarios registrados
    const usersSnap = await firestore.collection('users').get();
    const users: (UserProfile & { uid: string })[] = [];

    const userEmailMap = new Map<string, string>();
    usersSnap.forEach((doc) => {
      const data = doc.data() as UserProfile;
      userEmailMap.set(doc.id, data.email || '');
      users.push({
        uid: doc.id,
        ...data,
      });
    });

    // 3. Procesar datos de tenants y contar miembros
    for (const tDoc of tenantsSnap.docs) {
      const data = tDoc.data() as Tenant;
      let membersCount = 0;
      try {
        const membersSnap = await tDoc.ref.collection('members').get();
        membersCount = membersSnap.size;
      } catch (err) {
        // Fallback silencioso
      }

      tenants.push({
        ...data,
        id: tDoc.id,
        membersCount,
        ownerEmail: userEmailMap.get(data.ownerId) || data.email || 'Desconocido',
      });
    }

    // Ordenar tenants por fecha de creación descendente
    tenants.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    users.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // 4. Calcular métricas FinOps y de Plataforma
    const totalTenants = tenants.length;
    const totalUsers = users.length;
    const proTenants = tenants.filter(
      (t) => t.plan === 'Pro' || t.subscription?.status === 'active'
    ).length;
    const totalAdditionalSeats = tenants.reduce(
      (acc, t) => acc + (t.subscription?.additionalSeats || 0),
      0
    );

    return NextResponse.json({
      isConfigured: true,
      superAdminEmail: auth.email,
      stats: {
        totalTenants,
        totalUsers,
        proTenants,
        totalAdditionalSeats,
        estimatedMrr: proTenants * 29 + totalAdditionalSeats * 10,
      },
      tenants,
      users,
    });
  } catch (err: any) {
    console.error('[SuperAdmin Overview] Error recopilando datos:', err);
    return NextResponse.json(
      { error: err?.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
