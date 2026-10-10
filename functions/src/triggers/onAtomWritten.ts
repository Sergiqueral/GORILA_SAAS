import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { FUNCTION_REGION, API_CALL_DELAY_MS } from "../config";
import { enqueueAtomProcessingTask } from "../tasks/atomQueue";

/**
 * Genera un hash determinista SHA-256 para verificar la idempotencia
 */
function createContentHash(rawText: string): string {
  return crypto.createHash("sha256").update(rawText.trim()).digest("hex");
}

/**
 * Disparador Firestore: onDocumentWritten
 * Monitorea cambios en los átomos compartidos de las organizaciones (tenants/{tenantId}/atoms/{atomId})
 */
export const onTenantAtomWritten = onDocumentWritten(
  {
    document: "tenants/{tenantId}/atoms/{atomId}",
    region: FUNCTION_REGION,
  },
  async (event) => {
    const { tenantId, atomId } = event.params;
    const documentPath = `tenants/${tenantId}/atoms/${atomId}`;

    // 1. Si el documento fue eliminado, salir de forma inmediata
    if (!event.data?.after.exists) {
      console.log(`[Disparador] Átomo eliminado: ${documentPath}. Sin acción.`);
      return;
    }

    const beforeData = event.data?.before.data() || {};
    const afterData = event.data?.after.data() || {};

    const rawText = afterData.rawText;
    if (!rawText || typeof rawText !== "string") {
      console.log(`[Disparador] Átomo ${atomId} sin rawText válido. Omitiendo.`);
      return;
    }

    const isNew = !event.data?.before.exists;
    const rawTextChanged = isNew || beforeData.rawText !== rawText;

    // 2. Romper bucles infinitos: si el rawText no cambió (por ejemplo, el worker actualizó tags o schedule), ignorar
    if (!rawTextChanged) {
      console.log(`[Disparador] Átomo ${atomId} actualizado sin cambios en rawText. Omitiendo encolamiento.`);
      return;
    }

    // 3. Verificación de Idempotencia por Hash
    const contentHash = createContentHash(rawText);
    const idempotencyKey = `${atomId}_${contentHash.substring(0, 16)}`;

    // Si ya está completado con el mismo hash exacto, no duplicar procesamiento
    if (afterData.processingStatus === "completed" && afterData.processedContentHash === contentHash) {
      console.log(`[Disparador] Átomo ${atomId} ya procesado de forma idempotente con hash: ${contentHash}`);
      return;
    }

    // 4. Marcar estado inicial de encolamiento
    const db = admin.firestore();
    await db.doc(documentPath).set(
      {
        processingStatus: "pending",
        processingEnqueuedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastEnqueuedHash: contentHash,
      },
      { merge: true }
    );

    // 5. Encolar tarea en la Task Queue inyectando API_CALL_DELAY_MS = 1000
    await enqueueAtomProcessingTask(
      {
        tenantId,
        atomId,
        rawText,
        documentPath,
        idempotencyKey,
        enqueuedAt: Date.now(),
      },
      API_CALL_DELAY_MS
    );

    console.log(
      `[Disparador] Átomo ${atomId} encolado exitosamente con idempotencyKey=${idempotencyKey}`
    );
  }
);
