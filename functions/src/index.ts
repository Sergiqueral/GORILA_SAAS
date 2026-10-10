import * as admin from "firebase-admin";

// Inicializar Firebase Admin si no está inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}

// Exportar disparadores y colas de tareas de El Cerebro
export { onAtomWritten, onTenantAtomWritten, createContentHash } from "./triggers/onAtomWritten";
export { atomProcessingQueue } from "./tasks/atomQueue";
export { API_CALL_DELAY_MS, ATOM_TASK_QUEUE_NAME } from "./config";
