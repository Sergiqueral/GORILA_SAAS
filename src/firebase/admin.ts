import "@/lib/server-polyfill";
import admin from "firebase-admin";
import fs from "fs";
import path from "path";

export function initAdmin() {
  if (admin.apps.length) {
    return;
  }

  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "gorila-3b33c";

    // 1. Prioridad: Variables de entorno individuales en .env.local
    if (
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
      process.env.FIREBASE_ADMIN_PRIVATE_KEY
    ) {
      let rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
      // Normalizar saltos de línea tanto escapados como literales
      if (rawKey.startsWith('"') && rawKey.endsWith('"')) {
        rawKey = rawKey.slice(1, -1);
      }
      const privateKey = rawKey.replace(/\\n/g, '\n');

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL.trim(),
          privateKey,
        }),
        databaseURL: `https://${projectId}.firebaseio.com`,
      });
      return;
    }

    // 2. Variable con el contenido completo del JSON (FIREBASE_SERVICE_ACCOUNT_KEY)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const parsedKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
          credential: admin.credential.cert(parsedKey),
          databaseURL: `https://${projectId}.firebaseio.com`,
        });
        return;
      } catch (e: any) {
        console.warn("[Firebase Admin] Error parseando FIREBASE_SERVICE_ACCOUNT_KEY:", e?.message);
      }
    }

    // 3. Detección automática de archivo JSON en la raíz o ruta configurada
    const candidatePaths = [
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
      path.resolve(process.cwd(), "service-account.json"),
      path.resolve(process.cwd(), "serviceAccountKey.json"),
      path.resolve(process.cwd(), "firebase-admin-key.json"),
    ].filter(Boolean) as string[];

    for (const filePath of candidatePaths) {
      if (fs.existsSync(filePath)) {
        try {
          const fileContent = fs.readFileSync(filePath, "utf-8");
          const parsedKey = JSON.parse(fileContent);
          admin.initializeApp({
            credential: admin.credential.cert(parsedKey),
            databaseURL: `https://${projectId}.firebaseio.com`,
          });
          console.log(`[Firebase Admin] Inicializado con éxito usando: ${path.basename(filePath)}`);
          return;
        } catch (fileErr: any) {
          console.warn(`[Firebase Admin] Archivo encontrado en ${filePath} pero falló al leer:`, fileErr?.message);
        }
      }
    }

    // 4. Fallback: Google Application Default Credentials (GCP)
    try {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
      });
      return;
    } catch {
      // Ignorar si no está en GCP
    }

    console.warn("[Firebase Admin] Credenciales no encontradas. Configura FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY o añade service-account.json en la raíz.");
  } catch (err: any) {
    console.error("[Firebase Admin] Error crítico de inicialización:", err?.message || err);
  }
}

// Inicialización inicial
initAdmin();

export function getAdminAuth() {
  if (!admin.apps.length) initAdmin();
  return admin.apps.length ? admin.auth() : null;
}

export function getFirestoreDb() {
  if (!admin.apps.length) initAdmin();
  return admin.apps.length ? admin.firestore() : null;
}

export let adminAuth = admin.apps.length ? admin.auth() : null;
export let firestore = admin.apps.length ? admin.firestore() : null;

// Re-sincronizar exports si se llama initAdmin() posteriormente
if (!adminAuth && typeof Proxy !== 'undefined') {
  // Mantener fallback dinámico
  adminAuth = getAdminAuth();
  firestore = getFirestoreDb();
}