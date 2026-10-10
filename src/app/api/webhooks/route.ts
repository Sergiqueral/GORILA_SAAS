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
      // -----------------------------------------------------------------------
      // 2. REGLA 2: MAPEO DE SOBERANÍA (checkout.session.completed)
      // -----------------------------------------------------------------------
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId =
          session.client_reference_id ||
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

          let additionalSeats = parseInt(session.metadata?.additionalSeats || '0', 10) || 0;
          let currentPeriodEnd = Date.now() + 30 * 24 * 60 * 60 * 1000;
          let planPriceId = 'price_1UP8klLDAGQuuEjm755xMMmm';

          if (subscriptionId) {
            try {
              const sub = await stripe.subscriptions.retrieve(subscriptionId);
              if (sub.current_period_end) {
                currentPeriodEnd = sub.current_period_end * 1000;
              }
              for (const item of sub.items?.data || []) {
                if (item.price?.id === 'price_1UP8klLDAGQuuEjm755xMMmm' || item.price?.product === 'prod_VPyi482oBvWxcO') {
                  additionalSeats = Math.max(additionalSeats, item.quantity || 0);
                } else if (!planPriceId) {
                  planPriceId = item.price?.id || planPriceId;
                }
              }
            } catch (subErr) {
              console.warn('[FinOps Soberanía] Aviso recuperando suscripción desde Stripe:', subErr);
            }
          }

          const subscriptionData: TenantSubscription = {
            status: 'active',
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            planPriceId: planPriceId,
            additionalSeats: additionalSeats,
            currentPeriodEnd: currentPeriodEnd,
            id: subscriptionId,
            customerId: customerId,
            planName: 'Gorila Cockpit Pro',
            updatedAt: Date.now(),
          };

          await tenantRef.set(
            {
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              plan: 'Pro',
              subscription: subscriptionData,
              updatedAt: Date.now(),
            },
            { merge: true }
          );
          console.log(
            `[FinOps Soberanía] Espacio de trabajo ${tenantId} blindado y vinculado con Stripe (Seats: ${additionalSeats})`
          );
        } else {
          console.warn(
            `[FinOps Soberanía] Advertencia: tenant_id ausente en metadata/client_reference_id o Firestore indisponible (tenantId: ${tenantId})`
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
      case 'customer.subscription.updated': {
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

            // Calcular asientos adicionales contratados y el ID del precio base
            const ADDITIONAL_SEAT_PRICE_ID = 'price_1UP8klLDAGQuuEjm755xMMmm';
            let additionalSeats = 0;
            let planPriceId = '';

            for (const item of subscription.items?.data || []) {
              const priceId = item.price?.id;
              if (priceId === ADDITIONAL_SEAT_PRICE_ID || item.price?.product === 'prod_VPyi482oBvWxcO') {
                additionalSeats += (item.quantity || 0);
              } else if (!planPriceId) {
                planPriceId = priceId || '';
              }
            }

            if (additionalSeats === 0 && subscription.metadata?.additionalSeats) {
              additionalSeats = parseInt(subscription.metadata.additionalSeats, 10) || 0;
            }

            if (!planPriceId && subscription.items?.data?.[0]?.price?.id) {
              planPriceId = subscription.items.data[0].price.id;
            }

            const currentPeriodEnd = subscription.current_period_end
              ? subscription.current_period_end * 1000
              : Date.now() + 30 * 24 * 60 * 60 * 1000;

            const isPlanActive = status === 'active' || status === 'trialing';
            const effectivePlan = isPlanActive ? 'Pro' : 'Free';

            const subscriptionData: TenantSubscription = {
              status: status,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscription.id,
              planPriceId: planPriceId || ADDITIONAL_SEAT_PRICE_ID,
              additionalSeats: additionalSeats,
              currentPeriodEnd: currentPeriodEnd,
              id: subscription.id,
              customerId: customerId,
              planId: planPriceId,
              planName: 'Gorila Cockpit Pro',
              priceAmount: subscription.items?.data?.[0]?.price?.unit_amount || 2900,
              currency: subscription.items?.data?.[0]?.price?.currency || 'eur',
              currentPeriodStart: subscription.current_period_start
                ? subscription.current_period_start * 1000
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
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscription.id,
                subscription: subscriptionData,
                updatedAt: Date.now(),
              },
              { merge: true }
            );

            console.log(
              `[FinOps Ciclo de Vida] Nodo subscription actualizado para Tenant ${tenantId}: estado=${status}, plan=${effectivePlan}, seats=${additionalSeats}`
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
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        let tenantId =
          subscription.metadata?.tenant_id ||
          subscription.metadata?.tenantId;
        const customerId = subscription.customer as string;

        console.log(
          `[FinOps Ciclo de Vida] customer.subscription.deleted para suscripción: ${subscription.id}`
        );

        if (firestore) {
          if (!tenantId) {
            const snapBySub = await firestore
              .collection('tenants')
              .where('stripe_subscription_id', '==', subscription.id)
              .limit(1)
              .get();

            if (!snapBySub.empty) {
              tenantId = snapBySub.docs[0].id;
            }
          }

          if (tenantId) {
            const tenantRef = firestore.collection('tenants').doc(tenantId);
            const subscriptionData: TenantSubscription = {
              status: 'canceled',
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscription.id,
              planPriceId: subscription.items?.data?.[0]?.price?.id || 'price_1UP8klLDAGQuuEjm755xMMmm',
              additionalSeats: 0,
              currentPeriodEnd: subscription.ended_at ? subscription.ended_at * 1000 : Date.now(),
              id: subscription.id,
              customerId: customerId,
              planName: 'Free Tier',
              cancelAtPeriodEnd: true,
              canceledAt: Date.now(),
              updatedAt: Date.now(),
            };

            await tenantRef.set(
              {
                plan: 'Free',
                subscription: subscriptionData,
                updatedAt: Date.now(),
              },
              { merge: true }
            );

            console.log(
              `[FinOps Ciclo de Vida] Tenant ${tenantId} degradado a Free Tier por cancelación de suscripción`
            );
          }
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