import * as admin from "firebase-admin";
import { AtomTaskPayload } from "../tasks/atomQueue";

/**
 * Worker para el procesamiento desacoplado de átomos
 * Se ejecuta bajo demanda desde la Task Queue con garantías de idempotencia
 */
export async function processAtomTaskWorker(payload: AtomTaskPayload): Promise<void> {
  const db = admin.firestore();
  const atomDocRef = db.doc(payload.documentPath);

  console.log(`[Worker] Iniciando procesamiento para átomo: ${payload.atomId}`);

  // 1. Obtener estado actual del documento para garantizar idempotencia
  const snapshot = await atomDocRef.get();
  if (!snapshot.exists) {
    console.warn(`[Worker] Átomo ${payload.atomId} ya no existe en ${payload.documentPath}. Cancelando.`);
    return;
  }

  const currentData = snapshot.data() || {};

  // Verificar si ya fue procesado con esta misma clave de idempotencia
  if (
    currentData.processingStatus === "completed" &&
    currentData.processedIdempotencyKey === payload.idempotencyKey
  ) {
    console.log(
      `[Worker] Átomo ${payload.atomId} ya procesado previamente con clave: ${payload.idempotencyKey}. Abortando duplicado.`
    );
    return;
  }

  // 2. Adquirir candado / lease de procesamiento
  await atomDocRef.set(
    {
      processingStatus: "processing",
      processingStartedAt: admin.firestore.FieldValue.serverTimestamp(),
      currentWorkerIdempotencyKey: payload.idempotencyKey,
    },
    { merge: true }
  );

  try {
    // -----------------------------------------------------------------
    // PUNTO DE INYECCIÓN DE LA LÓGICA DEL WORKER:
    // Aquí se invocará la extracción de Entidades (@), Fechas/Horas (//),
    // Etiquetas (#), y análisis con Gemini / NLP según la necesidad
    // -----------------------------------------------------------------
    console.log(
      `[Worker] Ejecutando análisis sobre texto crudo (${payload.rawText.length} caracteres)...`
    );

    // Placeholder estructurado para la fase siguiente (lógica del worker)
    const processedAt = admin.firestore.FieldValue.serverTimestamp();

    // 3. Persistir finalización exitosa e idempotente
    await atomDocRef.set(
      {
        processingStatus: "completed",
        processedContentHash: payload.idempotencyKey.split("_")[1] || "",
        processedIdempotencyKey: payload.idempotencyKey,
        processedAt,
        processingError: null,
      },
      { merge: true }
    );

    console.log(`[Worker] Átomo ${payload.atomId} procesado con éxito.`);
  } catch (error: any) {
    console.error(`[Worker] Error durante el procesamiento del átomo ${payload.atomId}:`, error);

    await atomDocRef.set(
      {
        processingStatus: "failed",
        processingError: error?.message || "Error desconocido en el worker",
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Propagar error para que la Task Queue aplique la política de reintentos
    throw error;
  }
}
