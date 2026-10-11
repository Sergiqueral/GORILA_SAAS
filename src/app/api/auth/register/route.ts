import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, firestore } from '@/firebase/admin';

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    if (!adminAuth || !firestore) {
      return NextResponse.json(
        { error: 'Firebase Admin credentials are not configured on the server. Please register via client-side authentication.' },
        { status: 503 }
      );
    }

    const { email, password } = await req.json();

    const userRecord = await adminAuth.createUser({
      email,
      password,
    });

    const cleanEmail = (email || '').toLowerCase().trim();
    const targetTenantId = `tenant_${userRecord.uid}`;
    const now = Date.now();

    const batch = firestore.batch();

    // 1. Crear documento de usuario
    const userDoc = firestore.collection('users').doc(userRecord.uid);
    batch.set(userDoc, {
      email: cleanEmail,
      displayName: cleanEmail.split('@')[0] || 'Operario',
      role: "Free User",
      tenantId: targetTenantId,
      stripeId: null,
      subscriptionId: null,
      subscriptionStatus: null,
      createdAt: now,
      updatedAt: now,
    });

    // 2. Crear documento de tenant
    const tenantDoc = firestore.collection('tenants').doc(targetTenantId);
    batch.set(tenantDoc, {
      name: "Mi Organización",
      ownerId: userRecord.uid,
      plan: "Free",
      email: cleanEmail,
      createdAt: now,
      updatedAt: now,
    });

    // 3. Crear documento de miembro como owner
    const memberDoc = tenantDoc.collection('members').doc(userRecord.uid);
    batch.set(memberDoc, {
      role: "owner",
      email: cleanEmail,
      displayName: cleanEmail.split('@')[0] || 'Propietario',
      status: "active",
      joinedAt: now,
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      uid: userRecord.uid,
      tenantId: targetTenantId,
      role: 'owner',
    });
  } catch (error) {
    console.error('Error registering user:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred during registration' },
      { status: 400 }
    );
  }
}