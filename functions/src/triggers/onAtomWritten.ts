import { onDocumentWritten, FirestoreEvent, Change, DocumentSnapshot } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { FUNCTION_REGION, API_CALL_DELAY_MS } from "../config";
import { enqueueAtomProcessingTask } from "../tasks/atomQueue";

/**
 * Genera un hash determinista SHA-256 para verificar la idempotencia
 */
export function createContentHash(rawText: string): string {
  return crypto.createHash("sha256").update(rawText.trim()).digest("hex");
}

/**
 * Lógica unificada para procesar el evento onDocumentWritten de cualquier átomo
 */
async function processAtomWrittenEvent(
  atomId: string,
  documentPath: string,
  event: FirestoreEvent<Change<DocumentSnapshot> | undefined>,
  explicitTenantId?: string
) {
  // 1. Si el documento fue eliminado, salir de forma inmediata
  if (!event.data?.after.exists) {
    console.log(`[Disparador onAtomWritten] Átomo eliminado: ${documentPath}. Sin acción.`);
    return;
  }

  const beforeData = event.data?.before.data() || {};
  const afterData = event.data?.after.data() || {};

  const rawText = afterData.rawText;
  if (!rawText || typeof rawText !== "string") {
    console.log(`[Disparador onAtomWritten] Átomo ${atomId} sin rawText válido. Omitiendo.`);
    return;
  }

  const isNew = !event.data?.before.exists;
  const rawTextChanged = isNew || beforeData.rawText !== rawText;

  // 2. Romper bucles infinitos: si el rawText no cambió (por ejemplo, el worker actualizó tags o schedule), ignorar
  if (!rawTextChanged) {
    console.log(`[Disparador onAtomWritten] Átomo ${atomId} actualizado sin cambios en rawText. Omitiendo encolamiento.`);
    return;
  }

  // 3. Verificación de Idempotencia por Hash determinista SHA-256
  const contentHash = createContentHash(rawText);
  const idempotencyKey = `${atomId}_${contentHash.substring(0, 16)}`;
  const tenantId = explicitTenantId || afterData.tenant_id || afterData.tenantId || "default_tenant";

  // Si ya está completado con el mismo hash exacto, no duplicar procesamiento
  if (afterData.processingStatus === "completed" && afterData.processedContentHash === contentHash) {
    console.log(`[Disparador onAtomWritten] Átomo ${atomId} ya procesado de forma idempotente con hash: ${contentHash}`);
    return;
  }

  console.log(
    `[Disparador onAtomWritten] Átomo ${atomId} detectado. Hash SHA-256: ${contentHash}. Tenant: ${tenantId}. Preparando despacho...`
  );

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
    `[Disparador onAtomWritten] Átomo ${atomId} encolado exitosamente con idempotencyKey=${idempotencyKey} y retardo seguro de ${API_CALL_DELAY_MS}ms`
  );
}

/**
 * Disparador Firestore Principal: onAtomWritten
 * Monitorea creación y mutaciones en atoms/{atomId} (Colección raíz multi-tenant con tenant_id)
 */
export const onAtomWritten = onDocumentWritten(
  {
    document: "atoms/{atomId}",
    region: FUNCTION_REGION,
  },
  async (event) => {
    const { atomId } = event.params;
    await processAtomWrittenEvent(atomId, `atoms/${atomId}`, event);
  }
);

/**
 * Disparador Firestore Secundario: onTenantAtomWritten
 * Monitorea cambios en los átomos compartidos de las organizaciones (tenants/{tenantId}/atoms/{atomId})
 */
export const onTenantAtomWritten = onDocumentWritten(
  {
    document: "tenants/{tenantId}/atoms/{atomId}",
    region: FUNCTION_REGION,
  },
  async (event) => {
    const { tenantId, atomId } = event.params;
    await processAtomWrittenEvent(atomId, `tenants/${tenantId}/atoms/${atomId}`, event, tenantId);
  }
);
