import { NextResponse } from 'next/server';
import { stripe } from '@/stripe/config';

export async function POST(req: Request) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey || stripeKey.includes("dummy") || !stripeKey.startsWith("sk_")) {
      return NextResponse.json(
        {
          error: "Clave de Stripe no configurada. Añade STRIPE_SECRET_KEY=sk_test_... en tu archivo .env.local",
        },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { priceId, metadata = {} } = body;

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    // Si se pasa un priceId específico de Stripe, se usa; de lo contrario, se genera price_data dinámico
    const line_items = priceId
      ? [{ price: priceId, quantity: 1 }]
      : [
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: "Gorila Cockpit Pro",
                description: "Licencia de Operario - Fricción Cero",
              },
              unit_amount: 2900, // 29,00 €
              recurring: {
                interval: "month" as const,
              },
            },
            quantity: 1,
          },
        ];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      metadata: {
        ...metadata,
        product: "Gorila Pro",
      },
      mode: 'subscription',
      success_url: `${baseUrl}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard?payment=cancelled`,
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (err: any) {
    console.error("Error en Stripe Checkout:", err);
    return NextResponse.json(
      { error: err?.message || 'Error al iniciar la sesión de pago con Stripe' },
      { status: 500 }
    );
  }
}