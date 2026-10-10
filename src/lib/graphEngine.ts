import { ParsedAtom } from "./omnibarParser";

export interface EntityNode {
  id: string; // Identificador limpio (ej: "obra_central")
  name: string; // Etiqueta legible (ej: "@obra_central")
  atomCount: number; // Total de átomos vinculados
  pendingCount: number; // Tareas/observaciones pendientes
  completedCount: number; // Átomos completados
  completionRate: number; // Porcentaje de avance (0 - 100)
  firstSeen: number; // Epoch timestamp de primera mención
  lastSeen: number; // Epoch timestamp de última mención
  times: string[]; // Tiempos asociados (//hoy, //2h, etc.)
  relatedTags: { tag: string; count: number }[]; // Etiquetas correlacionadas
  relatedEntities: { entity: string; count: number }[]; // Otras entidades mencionadas en conjunto
  atoms: ParsedAtom[]; // Átomos vinculados en orden cronológico inverso
}

export interface TagNode {
  tag: string; // ej: "urgente"
  count: number;
  relatedEntities: { entity: string; count: number }[];
  atoms: ParsedAtom[];
}

export interface AtomicGraph {
  entities: Map<string, EntityNode>;
  tags: Map<string, TagNode>;
  totalAtoms: number;
  totalEntities: number;
}

/**
 * Normaliza el nombre de una entidad eliminando el prefijo '@' y espacios.
 */
export function normalizeEntityKey(rawEntity: string): string {
  if (!rawEntity) return "";
  return rawEntity.trim().replace(/^@/, "").toLowerCase();
}

/**
 * Normaliza una etiqueta eliminando el prefijo '#' y espacios.
 */
export function normalizeTagKey(rawTag: string): string {
  if (!rawTag) return "";
  return rawTag.trim().replace(/^#/, "").toLowerCase();
}

/**
 * Construye el Grafo Atómico Bidireccional en tiempo O(N).
 * Conecta cada Átomo con sus Entidades y Tags sin requerir tablas SQL ni formularios.
 */
export function buildAtomicGraph(atoms: ParsedAtom[]): AtomicGraph {
  const entityMap = new Map<string, EntityNode>();
  const tagMap = new Map<string, TagNode>();

  // Procesamos los átomos en orden cronológico inverso (los más nuevos primero)
  const sortedAtoms = [...atoms].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  for (const atom of sortedAtoms) {
    const atomEntities = (atom.entities || []).map(normalizeEntityKey).filter(Boolean);
    const atomTags = (atom.tags || []).map(normalizeTagKey).filter(Boolean);
    const atomTimes = atom.times || [];
    const timestamp = atom.createdAt || Date.now();

    // 1. Enlazar Átomo -> Entidades (Bidireccional)
    for (const entKey of atomEntities) {
      let node = entityMap.get(entKey);
      if (!node) {
        node = {
          id: entKey,
          name: `@${entKey}`,
          atomCount: 0,
          pendingCount: 0,
          completedCount: 0,
          completionRate: 0,
          firstSeen: timestamp,
          lastSeen: timestamp,
          times: [],
          relatedTags: [],
          relatedEntities: [],
          atoms: [],
        };
        entityMap.set(entKey, node);
      }

      node.atomCount += 1;
      if (atom.completed) {
        node.completedCount += 1;
      } else {
        node.pendingCount += 1;
      }

      if (timestamp < node.firstSeen) node.firstSeen = timestamp;
      if (timestamp > node.lastSeen) node.lastSeen = timestamp;

      node.atoms.push(atom);

      // Vincular tiempos únicos
      for (const t of atomTimes) {
        if (!node.times.includes(t)) {
          node.times.push(t);
        }
      }
    }

    // 2. Enlazar Átomo -> Tags (Bidireccional)
    for (const tagKey of atomTags) {
      let tNode = tagMap.get(tagKey);
      if (!tNode) {
        tNode = {
          tag: tagKey,
          count: 0,
          relatedEntities: [],
          atoms: [],
        };
        tagMap.set(tagKey, tNode);
      }
      tNode.count += 1;
      tNode.atoms.push(atom);
    }
  }

  // 3. Calcular Correlaciones de Segundo Grado (Co-ocurrencias de Tags y Entidades)
  entityMap.forEach((node) => {
    const tagFreq: Record<string, number> = {};
    const entityFreq: Record<string, number> = {};

    for (const atom of node.atoms) {
      // Tags relacionados
      for (const t of atom.tags || []) {
        const normTag = normalizeTagKey(t);
        tagFreq[normTag] = (tagFreq[normTag] || 0) + 1;
      }

      // Otras entidades en el mismo átomo
      for (const e of atom.entities || []) {
        const normEnt = normalizeEntityKey(e);
        if (normEnt !== node.id) {
          entityFreq[normEnt] = (entityFreq[normEnt] || 0) + 1;
        }
      }
    }

    node.relatedTags = Object.entries(tagFreq)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);

    node.relatedEntities = Object.entries(entityFreq)
      .map(([entity, count]) => ({ entity, count }))
      .sort((a, b) => b.count - a.count);

    node.completionRate =
      node.atomCount > 0 ? Math.round((node.completedCount / node.atomCount) * 100) : 0;
  });

  return {
    entities: entityMap,
    tags: tagMap,
    totalAtoms: atoms.length,
    totalEntities: entityMap.size,
  };
}

/**
 * Obtiene el contexto 360° instantáneo de una entidad específica.
 */
export function getEntityContext(atoms: ParsedAtom[], entityKey: string): EntityNode | null {
  if (!entityKey) return null;
  const graph = buildAtomicGraph(atoms);
  const normalized = normalizeEntityKey(entityKey);
  return graph.entities.get(normalized) || null;
}

/**
 * Devuelve la lista ordenada de entidades más activas en el sistema.
 */
export function getActiveEntities(atoms: ParsedAtom[], limit = 10): EntityNode[] {
  const graph = buildAtomicGraph(atoms);
  const result: EntityNode[] = [];
  graph.entities.forEach((node) => result.push(node));
  return result
    .sort((a, b) => b.atomCount - a.atomCount || b.lastSeen - a.lastSeen)
    .slice(0, limit);
}
