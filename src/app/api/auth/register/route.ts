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

    const userDoc = firestore.collection('users').doc(userRecord.uid);
    await userDoc.set({
      email: email,
      role: "Free User",
      stripeId: null,
      subscriptionId: null,
      subscriptionStatus: null,
      createdAt: Date.now()
    });

    return NextResponse.json({ success: true, uid: userRecord.uid });
  } catch (error) {
    console.error('Error registering user:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred during registration' },
      { status: 400 }
    );
  }
}