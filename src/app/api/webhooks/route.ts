import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '../../../stripe/config';
import { firestore } from '@/firebase/admin';
import { TenantSubscription, SubscriptionStatus } from '@/types/tenant';

/**
 * Endpoint de Webhooks nativos de Stripe para FinOps del Gorila Codex.
 * 
 * Reglas Arquitectónicas Estrictas:
 * 1. Firma Criptográfica (El Blindaje): Validación obligatoria del stripe-signature.
 * 2. Mapeo de Soberanía: Vinculación estricta de tenant_id a stripe_customer_id y stripe_subscription_id.
 * 3. Ciclo de Vida Reactivo: Mutación en tiempo real del nodo `subscription` en el Tenant.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  // ---------------------------------------------------------------------------
  // 1. REGLA 1: FIRMA CRIPTOGRÁFICA (EL BLINDAJE)
  // ---------------------------------------------------------------------------
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error('[FinOps Webhook Blindaje] Rechazado HTTP 400: Cabecera stripe-signature ausente o secreto no configurado.');
    return NextResponse.json(
      { error: 'Falta stripe-signature o STRIPE_WEBHOOK_SECRET no configurado' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error(`[FinOps Webhook Blindaje] Rechazado HTTP 400: Firma criptográfica inválida - ${err.message}`);
    return NextResponse.json(
      { error: `Firma criptográfica inválida: ${err.message}` },
      { status: 400 }
    );
  }

  console.log(`[FinOps Webhook] Evento validado criptográficamente: ${event.type} (ID: ${event.id})`);

  try {
    switch (event.type) {
      // -----------------------------------------------------------------------
      // 2. REGLA 2: MAPEO DE SOBERANÍA (checkout.session.completed)
      // -----------------------------------------------------------------------
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId =
          session.metadata?.tenant_id ||
          session.metadata?.tenantId;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const userId = session.metadata?.userId;

        console.log(
          `[FinOps Soberanía] checkout.session.completed recibido. Tenant: ${tenantId}, Customer: ${customerId}, Sub: ${subscriptionId}`
        );

        if (tenantId && firestore) {
          const tenantRef = firestore.collection('tenants').doc(tenantId);
          await tenantRef.set(
            {
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              plan: 'Pro',
              updatedAt: Date.now(),
            },
            { merge: true }
          );
          console.log(
            `[FinOps Soberanía] Espacio de trabajo ${tenantId} blindado y vinculado exitosamente con Stripe (Customer: ${customerId}, Sub: ${subscriptionId})`
          );
        } else {
          console.warn(
            `[FinOps Soberanía] Advertencia: tenant_id ausente en metadata de sesión o Firestore indisponible (tenantId: ${tenantId})`
          );
        }

        // Sincronizar espejo en el perfil de usuario si está presente
        if (userId && firestore) {
          const userDoc = firestore.collection('users').doc(userId);
          await userDoc.set(
            {
              stripeId: customerId,
              stripeCustomerId: customerId,
              subscriptionId: subscriptionId,
              subscriptionStatus: 'active',
              role: 'Pro User',
              tenantId: tenantId || undefined,
              updatedAt: Date.now(),
            },
            { merge: true }
          );
        }
        break;
      }

      // -----------------------------------------------------------------------
      // 3. REGLA 3: CICLO DE VIDA REACTIVO (subscription.created/updated/deleted)
      // -----------------------------------------------------------------------
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        let tenantId =
          subscription.metadata?.tenant_id ||
          subscription.metadata?.tenantId;
        const customerId = subscription.customer as string;
        const status = subscription.status as SubscriptionStatus;

        console.log(
          `[FinOps Ciclo de Vida] Evento ${event.type} para suscripción: ${subscription.id}. Estado: ${status}`
        );

        if (firestore) {
          // Si el tenant_id no vino explícito en metadata, buscar por stripe_subscription_id o stripe_customer_id
          if (!tenantId) {
            console.log(
              `[FinOps Ciclo de Vida] Buscando tenant por stripe_subscription_id (${subscription.id}) o customer_id (${customerId})...`
            );
            const snapBySub = await firestore
              .collection('tenants')
              .where('stripe_subscription_id', '==', subscription.id)
              .limit(1)
              .get();

            if (!snapBySub.empty) {
              tenantId = snapBySub.docs[0].id;
            } else {
              const snapByCust = await firestore
                .collection('tenants')
                .where('stripe_customer_id', '==', customerId)
                .limit(1)
                .get();
              if (!snapByCust.empty) {
                tenantId = snapByCust.docs[0].id;
              }
            }
          }

          if (tenantId) {
            const tenantRef = firestore.collection('tenants').doc(tenantId);

            // Construir el nuevo nodo reactivo 'subscription'
            const isPlanActive = status === 'active' || status === 'trialing';
            const effectivePlan = isPlanActive ? 'Pro' : 'Free';

            const subscriptionData: TenantSubscription = {
              id: subscription.id,
              customerId: customerId,
              status: status,
              planId: subscription.items?.data?.[0]?.price?.id || 'pro_plan',
              planName: 'Gorila Cockpit Pro',
              priceAmount: subscription.items?.data?.[0]?.price?.unit_amount || 2900,
              currency: subscription.items?.data?.[0]?.price?.currency || 'eur',
              currentPeriodStart: subscription.current_period_start
                ? subscription.current_period_start * 1000
                : null,
              currentPeriodEnd: subscription.current_period_end
                ? subscription.current_period_end * 1000
                : null,
              cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
              canceledAt: subscription.canceled_at
                ? subscription.canceled_at * 1000
                : null,
              updatedAt: Date.now(),
            };

            await tenantRef.set(
              {
                plan: effectivePlan,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscription.id,
                subscription: subscriptionData,
                updatedAt: Date.now(),
              },
              { merge: true }
            );

            console.log(
              `[FinOps Ciclo de Vida] Nodo subscription actualizado para Tenant ${tenantId}: estado=${status}, plan=${effectivePlan}`
            );
          } else {
            console.warn(
              `[FinOps Ciclo de Vida] Advertencia: No se pudo resolver tenant_id para la suscripción ${subscription.id}`
            );
          }

          // Sincronizar perfil de usuario si userId está disponible
          const userId = subscription.metadata?.userId;
          if (userId) {
            const userDoc = firestore.collection('users').doc(userId);
            await userDoc.set(
              {
                subscriptionStatus: status,
                subscriptionExpires: subscription.current_period_end
                  ? subscription.current_period_end * 1000
                  : null,
                role: status === 'active' || status === 'trialing' ? 'Pro User' : 'Free User',
                updatedAt: Date.now(),
              },
              { merge: true }
            );
          }
        } else {
          console.error('[FinOps Ciclo de Vida] Error: Firestore admin no disponible para persistir estado');
        }
        break;
      }

      default:
        console.log(`[FinOps Webhook] Evento no manejado: ${event.type}`);
    }

    return NextResponse.json({ received: true, event: event.type });
  } catch (handlerErr: any) {
    console.error('[FinOps Webhook] Error procesando evento en Firestore:', handlerErr);
    return NextResponse.json(
      { error: handlerErr?.message || 'Error procesando webhook' },
      { status: 500 }
    );
  }
}