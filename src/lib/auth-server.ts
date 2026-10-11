import "@/lib/server-polyfill";
import { adminAuth } from '@/firebase/admin';

export interface UserAuthResult {
  authenticated: boolean;
  uid?: string;
  email?: string;
  displayName?: string;
  error?: string;
}

/**
 * Valida la identidad criptográfica del usuario mediante el ID Token de Firebase Auth en el Servidor.
 * 1. Intenta verificación nativa vía Firebase Admin SDK.
 * 2. Fallback resiliente: Google Identity Toolkit REST API.
 */
export async function verifyUserAuth(req: Request): Promise<UserAuthResult> {
  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { authenticated: false, error: 'Cabecera Authorization Bearer ausente' };
    }

    const idToken = authHeader.replace(/^Bearer\s+/, '').trim();
    if (!idToken) {
      return { authenticated: false, error: 'Token de autenticación vacío' };
    }

    let userEmail: string | undefined;
    let userUid: string | undefined;
    let displayName: string | undefined;

    // 1. Intentar verificación con Firebase Admin SDK si está disponible
    if (adminAuth) {
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        userEmail = decoded.email;
        userUid = decoded.uid;
        displayName = (decoded.name as string) || undefined;
      } catch (adminErr: any) {
        console.warn('[Auth Server] Admin SDK verifyIdToken falló, recurriendo a verificación REST:', adminErr?.message);
      }
    }

    // 2. Fallback: Google Identity Toolkit REST API
    if (!userUid) {
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      if (!apiKey) {
        return { authenticated: false, error: 'NEXT_PUBLIC_FIREBASE_API_KEY no configurado' };
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
        return { authenticated: false, error: `Token inválido o expirado: ${errJson.error?.message || res.statusText}` };
      }

      const data = await res.json();
      const googleUser = data.users?.[0];
      if (!googleUser) {
        return { authenticated: false, error: 'No se encontró el usuario asociado al token' };
      }

      userEmail = googleUser.email;
      userUid = googleUser.localId;
      displayName = googleUser.displayName || undefined;
    }

    if (!userUid) {
      return { authenticated: false, error: 'No se pudo resolver el UID del usuario' };
    }

    return {
      authenticated: true,
      uid: userUid,
      email: userEmail,
      displayName,
    };
  } catch (err: any) {
    console.error('[Auth Server] Error crítico al verificar credenciales:', err);
    return { authenticated: false, error: err?.message || 'Error interno de validación' };
  }
}
