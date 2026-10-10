export type TenantRole = 'owner' | 'admin' | 'operator' | 'viewer';
export type MemberStatus = 'active' | 'pending';

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
