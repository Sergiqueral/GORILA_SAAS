import { NextResponse } from 'next/server';
import { stripe } from '@/stripe/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
    const { priceId, metadata = {}, tenantId, userId, userEmail } = body;

    const resolvedTenantId =
      metadata.tenant_id ||
      metadata.tenantId ||
      tenantId ||
      (userId ? `tenant_${userId}` : "tenant_default");

    const resolvedUserId = metadata.userId || userId || "anon";
    const resolvedUserEmail = metadata.userEmail || userEmail || "operario@gorila.saas";

    const ADDITIONAL_SEAT_PRICE_ID = 'price_1UP8klLDAGQuuEjm755xMMmm';
    const { additionalSeats = 0, action, customerId } = body;

    // Inyección nativa de tenant_id en metadata de Stripe (Mapeo de Soberanía)
    const sessionMetadata: Record<string, string> = {
      ...metadata,
      tenant_id: resolvedTenantId,
      tenantId: resolvedTenantId,
      userId: resolvedUserId,
      userEmail: resolvedUserEmail,
      additionalSeats: String(additionalSeats),
      product: "Gorila Cockpit Pro",
    };

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    // Manejo de línea de items: Base Pro y/o Asientos adicionales
    let line_items: any[] = [];

    if (action === 'add_seat' || (priceId === ADDITIONAL_SEAT_PRICE_ID && !body.includeBasePlan)) {
      // Compra exclusiva de asientos adicionales (ej. "Añadir usuario")
      const seatQuantity = Math.max(1, additionalSeats || 1);
      line_items = [{ price: ADDITIONAL_SEAT_PRICE_ID, quantity: seatQuantity }];
    } else if (priceId) {
      line_items = [{ price: priceId, quantity: 1 }];
      if (additionalSeats > 0) {
        line_items.push({ price: ADDITIONAL_SEAT_PRICE_ID, quantity: additionalSeats });
      }
    } else {
      line_items = [
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
      if (additionalSeats > 0) {
        line_items.push({ price: ADDITIONAL_SEAT_PRICE_ID, quantity: additionalSeats });
      }
    }

    const sessionParams: any = {
      payment_method_types: ['card'],
      line_items,
      client_reference_id: resolvedTenantId, // El Blindaje del Dato: client_reference_id = tenant_id
      metadata: sessionMetadata,
      subscription_data: {
        metadata: sessionMetadata,
      },
      mode: 'subscription',
      success_url: `${baseUrl}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard?payment=cancelled`,
    };

    if (customerId) {
      sessionParams.customer = customerId;
    } else if (resolvedUserEmail !== "operario@gorila.saas") {
      sessionParams.customer_email = resolvedUserEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

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