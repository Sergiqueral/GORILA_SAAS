import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { getFunctions } from "firebase-admin/functions";
import {
  API_CALL_DELAY_MS,
  ATOM_TASK_QUEUE_NAME,
  FUNCTION_REGION,
  TASK_QUEUE_OPTIONS,
} from "../config";
import { processAtomTaskWorker } from "../workers/atomWorker";

/**
 * Payload transferido a través de Cloud Tasks
 */
export interface AtomTaskPayload {
  tenantId?: string;
  userId?: string;
  atomId: string;
  rawText: string;
  documentPath: string;
  idempotencyKey: string;
  enqueuedAt: number;
  attempt?: number;
}

/**
 * Encola un átomo en la Task Queue garantizando el retardo (delay)
 * para asegurar idempotencia y evitar saturar APIs de IA o servicios externos.
 */
export async function enqueueAtomProcessingTask(
  payload: AtomTaskPayload,
  delayMs: number = API_CALL_DELAY_MS
): Promise<void> {
  const queue = getFunctions().taskQueue(ATOM_TASK_QUEUE_NAME);

  const delaySeconds = Math.max(1, Math.ceil(delayMs / 1000));

  await queue.enqueue(payload, {
    scheduleDelaySeconds: delaySeconds,
    dispatchDeadlineSeconds: 180,
  });

  console.log(
    `[TaskQueue] Tarea encolada para el átomo ${payload.atomId} (Path: ${payload.documentPath}). Retardo programado: ${delaySeconds}s (${delayMs}ms)`
  );
}

/**
 * Receptor de la Task Queue (Cloud Functions v2)
 * Maneja los despachos secuenciados y desacoplados.
 */
export const atomProcessingQueue = onTaskDispatched<AtomTaskPayload>(
  {
    retryConfig: TASK_QUEUE_OPTIONS.retryConfig,
    rateLimits: TASK_QUEUE_OPTIONS.rateLimits,
    region: FUNCTION_REGION,
  },
  async (req) => {
    const payload = req.data;
    console.log(
      `[TaskQueue] Despachando tarea para átomo: ${payload.atomId} con clave de idempotencia: ${payload.idempotencyKey}`
    );

    // Retardo táctico inyectado para garantizar el espaciado exacto entre ejecuciones
    if (API_CALL_DELAY_MS > 0) {
      await new Promise((resolve) => setTimeout(resolve, API_CALL_DELAY_MS));
    }

    // Delegación en el worker para el procesamiento del átomo
    await processAtomTaskWorker(payload);
  }
);
