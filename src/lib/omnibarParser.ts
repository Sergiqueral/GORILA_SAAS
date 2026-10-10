export interface AtomTimeSchedule {
  recordDate: string; // Formato estricto ISO "YYYY-MM-DD" (Editable por el usuario)
  isAllDay: boolean; // true si no tiene franja horaria definida
  startTime?: string; // Formato 24h "HH:mm" (ej. "10:00")
  endTime?: string; // Formato 24h "HH:mm" (ej. "12:30", define la franja)
}

export interface ParsedAtom {
  id: string;
  rawText: string;
  cleanText: string;
  entities: string[]; // @entidad
  times: string[]; // //tiempo
  tags: string[]; // #tag
  schedule: AtomTimeSchedule; // Dimensión temporal operativa principal
  timestamp: string; // Hora formateada de captura
  createdAt: number; // Epoch timestamp inmutable de creación (auditoría)
  updatedAt?: number; // Epoch timestamp de última edición
  completed: boolean;
}

export interface ParseResult {
  raw: string;
  cleanText: string;
  entities: string[];
  times: string[];
  tags: string[];
  schedule: AtomTimeSchedule;
  hasTokens: boolean;
}

/**
 * Convierte un objeto Date a string YYYY-MM-DD local.
 */
export function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Normaliza horas al formato estándar "HH:mm"
 */
function normalizeTimeStr(raw: string): string | undefined {
  if (!raw) return undefined;
  const match = raw.match(/^([0-1]?[0-9]|2[0-3])(?::([0-5][0-9]))?$/);
  if (!match) return undefined;
  const hours = match[1].padStart(2, "0");
  const minutes = match[2] ? match[2] : "00";
  return `${hours}:${minutes}`;
}

/**
 * Infiere de manera soberana y sin fricción la programación temporal
 * a partir de la lista de tokens //tiempo.
 */
export function inferAtomSchedule(times: string[], fallbackTimestamp = Date.now()): AtomTimeSchedule {
  const baseDate = new Date(fallbackTimestamp);
  let recordDate = formatDateToISO(baseDate);
  let isAllDay = true;
  let startTime: string | undefined = undefined;
  let endTime: string | undefined = undefined;

  const weekdayMap: Record<string, number> = {
    domingo: 0,
    lunes: 1,
    martes: 2,
    miercoles: 3,
    miércoles: 3,
    jueves: 4,
    viernes: 5,
    sabado: 6,
    sábado: 6,
  };

  // Descomponer tokens compuestos (ej: "mañana 10:00" -> ["mañana", "10:00"])
  const flatTokens: string[] = [];
  for (const t of times) {
    if (t.includes(" ")) {
      flatTokens.push(...t.split(/\s+/));
    } else {
      flatTokens.push(t);
    }
  }

  for (const rawToken of flatTokens) {
    const token = rawToken.toLowerCase().trim();

    // 1. Días relativos
    if (token === "hoy") {
      recordDate = formatDateToISO(new Date());
    } else if (token === "manana" || token === "mañana") {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      recordDate = formatDateToISO(d);
    } else if (token === "ayer") {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      recordDate = formatDateToISO(d);
    } else if (token === "pasadomanana" || token === "pasadomañana") {
      const d = new Date();
      d.setDate(d.getDate() + 2);
      recordDate = formatDateToISO(d);
    }
    // 2. Días de la semana (ej. //lunes, //viernes)
    else if (weekdayMap[token] !== undefined) {
      const targetDay = weekdayMap[token];
      const d = new Date();
      const currentDay = d.getDay();
      let diff = targetDay - currentDay;
      if (diff <= 0) diff += 7; // Próximo día de la semana
      d.setDate(d.getDate() + diff);
      recordDate = formatDateToISO(d);
    }
    // 3. Fechas absolutas ISO YYYY-MM-DD
    else if (/^\d{4}-\d{2}-\d{2}$/.test(token)) {
      recordDate = token;
    }
    // 4. Fechas formato DD-MM-YYYY o DD/MM/YYYY
    else if (/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.test(token)) {
      const parts = token.split(/[-/]/);
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      const year = parts[2];
      recordDate = `${year}-${month}-${day}`;
    }
    // 5. Fechas formato DD-MM o DD/MM (asume año actual)
    else if (/^(\d{1,2})[-/](\d{1,2})$/.test(token)) {
      const parts = token.split(/[-/]/);
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      const year = baseDate.getFullYear();
      recordDate = `${year}-${month}-${day}`;
    }
    // 6. Franja horaria completa (ej. 10:00-12:00, 10-12, 09:30-11:00)
    else if (/^([0-2]?[0-9](?::[0-5][0-9])?)-([0-2]?[0-9](?::[0-5][0-9])?)$/.test(token)) {
      const [startRaw, endRaw] = token.split("-");
      const startNorm = normalizeTimeStr(startRaw);
      const endNorm = normalizeTimeStr(endRaw);
      if (startNorm) {
        startTime = startNorm;
        endTime = endNorm;
        isAllDay = false;
      }
    }
    // 7. Hora simple (ej. 14:00, 9:30, 14h)
    else if (/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/.test(token)) {
      startTime = normalizeTimeStr(token);
      isAllDay = false;
    } else if (/^([0-1]?[0-9]|2[0-3])h$/.test(token)) {
      const hourPart = token.replace("h", "");
      startTime = normalizeTimeStr(hourPart);
      isAllDay = false;
    }
  }

  return {
    recordDate,
    isAllDay,
    startTime,
    endTime,
  };
}

/**
 * Asegura compatibilidad con átomos guardados que puedan no tener schedule.
 */
export function ensureAtomSchedule(atom: Partial<ParsedAtom>): AtomTimeSchedule {
  if (atom.schedule && atom.schedule.recordDate) {
    return atom.schedule;
  }
  return inferAtomSchedule(atom.times || [], atom.createdAt || Date.now());
}

/**
 * Parser de Fricción Cero para la Omnibarra de Gorila.
 * Extrae entidades (@), tiempos (//) y etiquetas (#) de una sola cadena de texto.
 */
export function parseOmnibarInput(input: string): ParseResult {
  if (!input || !input.trim()) {
    return {
      raw: "",
      cleanText: "",
      entities: [],
      times: [],
      tags: [],
      schedule: inferAtomSchedule([]),
      hasTokens: false,
    };
  }

  // Regex para tokens: soporta letras, números, guiones, barras, tildes y expresiones temporales compuestas
  const TIME_TOKEN_REGEX = /\/\/([a-zA-Z0-9_\-:/áéíóúÁÉÍÓÚñÑ]+(?:\s+(?:[0-2]?[0-9](?::[0-5][0-9])?|[0-2]?[0-9]h)(?:-(?:[0-2]?[0-9](?::[0-5][0-9])?|[0-2]?[0-9]h))?)?)/g;

  const entityMatches = input.match(/@([a-zA-Z0-9_\-áéíóúÁÉÍÓÚñÑ]+)/g) || [];
  const timeMatches = input.match(TIME_TOKEN_REGEX) || [];
  const tagMatches = input.match(/#([a-zA-Z0-9_\-áéíóúÁÉÍÓÚñÑ]+)/g) || [];

  const entities = Array.from(new Set(entityMatches.map((e) => e.slice(1))));
  const times = Array.from(new Set(timeMatches.map((t) => t.slice(2))));
  const tags = Array.from(new Set(tagMatches.map((t) => t.slice(1))));

  const schedule = inferAtomSchedule(times);

  const cleanText = input
    .replace(/@([a-zA-Z0-9_\-áéíóúÁÉÍÓÚñÑ]+)/g, "")
    .replace(TIME_TOKEN_REGEX, "")
    .replace(/#([a-zA-Z0-9_\-áéíóúÁÉÍÓÚñÑ]+)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    raw: input,
    cleanText: cleanText || input.trim(),
    entities,
    times,
    tags,
    schedule,
    hasTokens: entities.length > 0 || times.length > 0 || tags.length > 0,
  };
}
