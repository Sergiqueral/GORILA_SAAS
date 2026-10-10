/**
 * Configuración de El Cerebro (Cloud Functions & Task Queues)
 * Gorila SaaS - Motor Asíncrono de Procesamiento de Átomos
 */

// Retardo obligatorio entre llamadas API para respetar cuotas de servicio externo e idempotencia
export const API_CALL_DELAY_MS = 1000;

// Nombre de la Task Queue para el procesamiento desacoplado de átomos
export const ATOM_TASK_QUEUE_NAME = "atomProcessingQueue";

// Región por defecto para Cloud Functions v2
export const FUNCTION_REGION = "europe-west1";

// Configuración de límites y reintentos para la cola de tareas
export const TASK_QUEUE_OPTIONS = {
  retryConfig: {
    maxAttempts: 3,
    minBackoffSeconds: 2,
    maxBackoffSeconds: 60,
    maxDoublings: 3,
  },
  rateLimits: {
    maxConcurrentDispatches: 5,
    maxDispatchesPerSecond: 1, // 1 despacho por segundo alineado con API_CALL_DELAY_MS = 1000
  },
};

// Estados del ciclo de vida del átomo en El Cerebro
export type AtomProcessingStatus = "pending" | "processing" | "completed" | "failed";
