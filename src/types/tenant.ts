export type TenantRole = 'owner' | 'admin' | 'operator' | 'viewer';
export type MemberStatus = 'active' | 'pending';
export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'trialing'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

export interface TenantSubscription {
  status: SubscriptionStatus;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  planPriceId: string;        // Ej: price_1UP8klLDAGQuuEjm755xMMmm
  additionalSeats: number;    // Cantidad de "Usuarios adicionales" contratados
  currentPeriodEnd: number;   // Timestamp de renovación/caducidad
  // Campos complementarios del Gorila Codex para FinOps
  id?: string;                // stripe_subscription_id
  customerId?: string;        // stripe_customer_id
  planId?: string;
  planName?: string;
  priceAmount?: number;
  currency?: string;
  currentPeriodStart?: number | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: number | null;
  updatedAt?: number;
}

export interface TenantMember {
  id: string; // member Auth UID or unique invite identifier
  email: string;
  displayName?: string;
  role: TenantRole;
  status: MemberStatus;
  joinedAt: number;
  invitedBy?: string;
}

export interface Tenant {
  id: string;
  name: string;
  ownerId: string;
  slug?: string;
  plan?: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscription?: TenantSubscription | null;
  cif?: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface UserProfile {
  email: string;
  displayName?: string;
  photoURL?: string;
  role?: string;
  tenantId?: string;
  stripeId?: string | null;
  stripeCustomerId?: string | null;
  subscriptionId?: string | null;
  subscriptionStatus?: string | null;
  subscriptionExpires?: number | null;
  createdAt: number;
  updatedAt?: number;
}
