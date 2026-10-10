import { NextResponse } from 'next/server';
import { stripe } from '@/stripe/config';
import { firestore } from '@/firebase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Portal del Cliente de Stripe (Ley de la Fricción Cero).
 * Genera un enlace seguro con 1 clic para que el usuario gestione métodos de pago,
 * descargue facturas y cambie de plan directamente en la interfaz optimizada de Stripe.
 */
export async function POST(req: Request) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey || stripeKey.includes('dummy') || !stripeKey.startsWith('sk_')) {
      return NextResponse.json(
        { error: 'Clave de Stripe no configurada en STRIPE_SECRET_KEY' },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { tenantId, customerId: rawCustomerId, returnUrl } = body;

    let customerId = rawCustomerId;

    // Si no se pasa customerId directo, resolverlo desde el espacio de trabajo en Firestore
    if (!customerId && tenantId && firestore) {
      const tenantDoc = await firestore.collection('tenants').doc(tenantId).get();
      if (tenantDoc.exists) {
        const data = tenantDoc.data();
        customerId =
          data?.stripeCustomerId ||
          data?.stripe_customer_id ||
          data?.subscription?.stripeCustomerId ||
          data?.subscription?.customerId;
      }
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'No se encontró un stripeCustomerId asociado a este espacio de trabajo' },
        { status: 404 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${baseUrl}/dashboard`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err: any) {
    console.error('[FinOps Portal] Error creando sesión del portal de clientes:', err);
    return NextResponse.json(
      { error: err?.message || 'Error al conectar con el portal de facturación de Stripe' },
      { status: 500 }
    );
  }
}
