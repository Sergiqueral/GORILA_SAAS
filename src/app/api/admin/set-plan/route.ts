import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/superadmin-server';
import { firestore } from '@/firebase/admin';
import { TenantSubscription } from '@/types/tenant';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const auth = await verifySuperAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'No autorizado' }, { status: 403 });
    }

    if (!firestore) {
      return NextResponse.json(
        { error: 'Firebase Admin SDK no está disponible en el servidor' },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { tenantId, plan, additionalSeats = 0, reason } = body;

    if (!tenantId || !plan) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos: tenantId y plan' },
        { status: 400 }
      );
    }

    const tenantRef = firestore.collection('tenants').doc(tenantId);
    const tenantDoc = await tenantRef.get();

    if (!tenantDoc.exists) {
      return NextResponse.json(
        { error: `El espacio de trabajo ${tenantId} no existe` },
        { status: 404 }
      );
    }

    const isPro = plan === 'Pro';
    const seats = Math.max(0, parseInt(String(additionalSeats), 10) || 0);

    const subscriptionData: TenantSubscription = {
      status: isPro ? 'active' : 'canceled',
      stripeCustomerId: tenantDoc.data()?.stripe_customer_id || `manual_${tenantId}`,
      stripeSubscriptionId: tenantDoc.data()?.stripe_subscription_id || `manual_sub_${tenantId}`,
      planPriceId: isPro ? 'manual_override_pro' : 'free',
      additionalSeats: seats,
      currentPeriodEnd: isPro ? Date.now() + 365 * 24 * 60 * 60 * 1000 : Date.now(),
      planName: isPro ? 'Gorila Cockpit Pro (God Mode Override)' : 'Free Tier',
      priceAmount: isPro ? 2900 : 0,
      currency: 'eur',
      updatedAt: Date.now(),
    };

    await tenantRef.set(
      {
        plan: isPro ? 'Pro' : 'Free',
        subscription: subscriptionData,
        manualOverrideBy: auth.email,
        manualOverrideReason: reason || 'Ajuste manual de plataforma SuperAdmin',
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    console.log(
      `[SuperAdmin] Plan de ${tenantId} actualizado a ${plan} (Asientos: ${seats}) por ${auth.email}`
    );

    return NextResponse.json({
      success: true,
      message: `Plan del espacio ${tenantId} actualizado a ${plan} con ${seats} asientos adicionales`,
      tenantId,
      plan,
      additionalSeats: seats,
    });
  } catch (err: any) {
    console.error('[SuperAdmin Set-Plan] Error ajustando plan:', err);
    return NextResponse.json(
      { error: err?.message || 'Error al actualizar el plan del tenant' },
      { status: 500 }
    );
  }
}
