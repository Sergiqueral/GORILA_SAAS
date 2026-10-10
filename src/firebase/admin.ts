import admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    if (
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
      process.env.FIREBASE_ADMIN_PRIVATE_KEY
    ) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
        databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`,
      });
    } else {
      console.warn("FIREBASE_ADMIN_CLIENT_EMAIL or FIREBASE_ADMIN_PRIVATE_KEY not set. Firebase Admin features will be unavailable.");
    }
  } catch (err) {
    console.error("Firebase admin initialization failed:", err);
  }
}

export const adminAuth = admin.apps.length ? admin.auth() : null;
export const firestore = admin.apps.length ? admin.firestore() : null;