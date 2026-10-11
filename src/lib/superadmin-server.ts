import "@/lib/server-polyfill";
import { verifyUserAuth } from '@/lib/auth-server';
import { isSuperAdminEmail } from '@/lib/superadmin';

export interface SuperAdminAuthResult {
  authorized: boolean;
  email?: string;
  uid?: string;
  error?: string;
}

/**
 * Valida la identidad criptográfica del llamador usando el ID Token de Firebase Auth en el Servidor
 * y comprueba si tiene privilegios de SuperAdmin.
 */
export async function verifySuperAdmin(req: Request): Promise<SuperAdminAuthResult> {
  const authResult = await verifyUserAuth(req);
  if (!authResult.authenticated || !authResult.email) {
    return {
      authorized: false,
      error: authResult.error || 'Autenticación requerida',
    };
  }

  if (!isSuperAdminEmail(authResult.email)) {
    return {
      authorized: false,
      error: `Acceso denegado: El usuario ${authResult.email} no tiene privilegios de SuperAdmin.`,
    };
  }

  return {
    authorized: true,
    email: authResult.email,
    uid: authResult.uid,
  };
}

