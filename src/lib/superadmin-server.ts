import "@/lib/server-polyfill";
import { adminAuth } from '@/firebase/admin';
import { isSuperAdminEmail } from '@/lib/superadmin';

export interface SuperAdminAuthResult {
  authorized: boolean;
  email?: string;
  uid?: string;
  error?: string;
}

/**
 * Valida la identidad criptográfica del llamador usando el ID Token de Firebase Auth en el Servidor.
 * 1. Intenta verificación nativa vía Firebase Admin SDK.
 * 2. Fallback: Verificación con Google Identity Toolkit REST API (tolerante a entornos sin clave privada local).
 */
export async function verifySuperAdmin(req: Request): Promise<SuperAdminAuthResult> {
  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { authorized: false, error: 'Cabecera Authorization Bearer ausente' };
    }

    const idToken = authHeader.replace(/^Bearer\s+/, '').trim();
    if (!idToken) {
      return { authorized: false, error: 'Token de autenticación vacío' };
    }

    let userEmail: string | undefined;
    let userUid: string | undefined;

    // 1. Intentar verificación con Firebase Admin SDK si está disponible
    if (adminAuth) {
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        userEmail = decoded.email;
        userUid = decoded.uid;
      } catch (adminErr: any) {
        console.warn('[SuperAdmin Auth] Admin SDK verifyIdToken falló, recurriendo a verificación REST:', adminErr?.message);
      }
    }

    // 2. Fallback: Google Identity Toolkit REST API
    if (!userEmail) {
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      if (!apiKey) {
        return { authorized: false, error: 'NEXT_PUBLIC_FIREBASE_API_KEY no configurado' };
      }

      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        }
      );

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        return { authorized: false, error: `Token inválido o expirado: ${errJson.error?.message || res.statusText}` };
      }

      const data = await res.json();
      const googleUser = data.users?.[0];
      if (!googleUser) {
        return { authorized: false, error: 'No se encontró el usuario asociado al token' };
      }

      userEmail = googleUser.email;
      userUid = googleUser.localId;
    }

    if (!userEmail || !isSuperAdminEmail(userEmail)) {
      return {
        authorized: false,
        error: `Acceso denegado: El usuario ${userEmail || 'desconocido'} no tiene privilegios de SuperAdmin.`,
      };
    }

    return {
      authorized: true,
      email: userEmail,
      uid: userUid,
    };
  } catch (err: any) {
    console.error('[SuperAdmin Auth] Error crítico al verificar credenciales:', err);
    return { authorized: false, error: err?.message || 'Error interno de validación' };
  }
}
