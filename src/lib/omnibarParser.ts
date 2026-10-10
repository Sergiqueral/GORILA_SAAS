export interface ParsedAtom {
  id: string;
  rawText: string;
  cleanText: string;
  entities: string[]; // @entidad
  times: string[];    // //tiempo
  tags: string[];     // #tag
  timestamp: string;
  createdAt: number;
  completed: boolean;
}

export interface ParseResult {
  raw: string;
  cleanText: string;
  entities: string[];
  times: string[];
  tags: string[];
  hasTokens: boolean;
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
      hasTokens: false,
    };
  }

  // Regex para tokens: soporta letras, números, guiones, barras y tildes
  const entityMatches = input.match(/@([a-zA-Z0-9_\-áéíóúÁÉÍÓÚñÑ]+)/g) || [];
  const timeMatches = input.match(/\/\/([a-zA-Z0-9_\-:áéíóúÁÉÍÓÚñÑ]+)/g) || [];
  const tagMatches = input.match(/#([a-zA-Z0-9_\-áéíóúÁÉÍÓÚñÑ]+)/g) || [];

  const entities = Array.from(new Set(entityMatches.map((e) => e.slice(1))));
  const times = Array.from(new Set(timeMatches.map((t) => t.slice(2))));
  const tags = Array.from(new Set(tagMatches.map((t) => t.slice(1))));

  const cleanText = input
    .replace(/@([a-zA-Z0-9_\-áéíóúÁÉÍÓÚñÑ]+)/g, "")
    .replace(/\/\/([a-zA-Z0-9_\-:áéíóúÁÉÍÓÚñÑ]+)/g, "")
    .replace(/#([a-zA-Z0-9_\-áéíóúÁÉÍÓÚñÑ]+)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    raw: input,
    cleanText: cleanText || input.trim(),
    entities,
    times,
    tags,
    hasTokens: entities.length > 0 || times.length > 0 || tags.length > 0,
  };
}
