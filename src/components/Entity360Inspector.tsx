"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { ParsedAtom, parseOmnibarInput } from "@/lib/omnibarParser";
import { getEntityContext, EntityNode, normalizeEntityKey } from "@/lib/graphEngine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AtSign,
  Clock,
  Hash,
  X,
  CheckCircle2,
  Circle,
  Trash2,
  CornerDownLeft,
  Calendar,
  Layers,
  Activity,
  ArrowRight,
  TrendingUp,
  Sparkles,
} from "lucide-react";

interface Entity360InspectorProps {
  entityKey: string | null;
  atoms: ParsedAtom[];
  isOpen: boolean;
  outdoorMode?: boolean;
  onClose: () => void;
  onToggleComplete: (atomId: string) => void;
  onDeleteAtom: (atomId: string) => void;
  onCaptureForEntity: (rawText: string) => void;
  onSelectEntity?: (entityKey: string) => void;
}

export function Entity360Inspector({
  entityKey,
  atoms,
  isOpen,
  outdoorMode = false,
  onClose,
  onToggleComplete,
  onDeleteAtom,
  onCaptureForEntity,
  onSelectEntity,
}: Entity360InspectorProps) {
  const [quickInput, setQuickInput] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "pending" | "completed">("all");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Obtener el nodo 360° del Grafo Atómico en tiempo real
  const entityNode: EntityNode | null = useMemo(() => {
    if (!entityKey) return null;
    return getEntityContext(atoms, entityKey);
  }, [atoms, entityKey]);

  // Manejo de atajo Escape y bloqueo de scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Autofoco al abrir el inspector
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setQuickInput("");
      setActiveFilter("all");
      setFilterTag(null);
    }
  }, [isOpen, entityKey]);

  if (!isOpen || !entityKey) return null;

  const displayName = entityNode ? entityNode.name : `@${normalizeEntityKey(entityKey)}`;

  // Envío rápido de captura in-context
  const handleQuickSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = quickInput.trim();
    if (!trimmed) return;

    // Si el usuario no escribió explícitamente la @entidad, la adjuntamos automáticamente
    const hasCurrentEntity = trimmed.toLowerCase().includes(displayName.toLowerCase());
    const finalRaw = hasCurrentEntity ? trimmed : `${trimmed} ${displayName}`;

    onCaptureForEntity(finalRaw);
    setQuickInput("");

    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  // Filtrado de átomos dentro de la vista 360°
  const displayedAtoms = (entityNode?.atoms || []).filter((atom) => {
    if (activeFilter === "pending" && atom.completed) return false;
    if (activeFilter === "completed" && !atom.completed) return false;
    if (filterTag && !atom.tags?.some((t) => t.toLowerCase() === filterTag.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="entity-360-title"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className={`fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in-0`}
    >
      <div
        className={`w-full max-w-2xl h-full flex flex-col shadow-2xl transition-all duration-300 transform animate-in slide-in-from-right sm:border-l ${
          outdoorMode
            ? "bg-white text-black border-l-4 border-black font-mono font-bold"
            : "bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-800"
        }`}
      >
        {/* ============================================================ */}
        {/* CABECERA 360° DE LA ENTIDAD                                  */}
        {/* ============================================================ */}
        <header
          className={`p-5 sm:p-6 border-b flex flex-col gap-4 ${
            outdoorMode
              ? "border-black bg-zinc-100"
              : "border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className={`p-2 rounded-lg ${
                  outdoorMode
                    ? "bg-black text-white"
                    : "bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300"
                }`}
              >
                <AtSign className="h-5 w-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2
                    id="entity-360-title"
                    className="text-xl sm:text-2xl font-bold tracking-tight font-mono"
                  >
                    {displayName}
                  </h2>
                  <Badge variant="entity" className="text-[10px] tracking-widest uppercase">
                    Grafo Atómico
                  </Badge>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                  Contexto vivo y soberano sin formularios
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                outdoorMode
                  ? "bg-black text-white hover:bg-zinc-800"
                  : "text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
              title="Cerrar (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* HUD DE RENDIMIENTO & MÉTRICAS VIVAS */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-2">
            <div
              className={`p-3 rounded-lg border flex flex-col justify-between ${
                outdoorMode
                  ? "border-black bg-white"
                  : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40"
              }`}
            >
              <span className="text-[11px] font-mono text-zinc-500 uppercase flex items-center gap-1">
                <Layers className="h-3 w-3" /> Total Átomos
              </span>
              <span className="text-xl sm:text-2xl font-bold font-mono mt-1">
                {entityNode?.atomCount || 0}
              </span>
            </div>

            <div
              className={`p-3 rounded-lg border flex flex-col justify-between ${
                outdoorMode
                  ? "border-black bg-white"
                  : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40"
              }`}
            >
              <span className="text-[11px] font-mono text-zinc-500 uppercase flex items-center gap-1">
                <Activity className="h-3 w-3 text-amber-500" /> Pendientes
              </span>
              <span className="text-xl sm:text-2xl font-bold font-mono mt-1 text-amber-600 dark:text-amber-400">
                {entityNode?.pendingCount || 0}
              </span>
            </div>

            <div
              className={`p-3 rounded-lg border flex flex-col justify-between ${
                outdoorMode
                  ? "border-black bg-white"
                  : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40"
              }`}
            >
              <span className="text-[11px] font-mono text-zinc-500 uppercase flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-emerald-500" /> Avance
              </span>
              <span className="text-xl sm:text-2xl font-bold font-mono mt-1 text-emerald-600 dark:text-emerald-400">
                {entityNode?.completionRate || 0}%
              </span>
            </div>
          </div>

          {/* BARRA DE PROGRESO */}
          <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                outdoorMode ? "bg-black" : "bg-emerald-500"
              }`}
              style={{ width: `${entityNode?.completionRate || 0}%` }}
            />
          </div>

          {/* ENLACES RADIALES: TIEMPOS ASOCIADOS, TAGS Y CO-ENTIDADES */}
          <div className="space-y-2 pt-1 text-xs">
            {/* Tiempos de ejecución vinculados */}
            {entityNode?.times && entityNode.times.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1 mr-1">
                  <Clock className="h-3 w-3" /> Tiempos:
                </span>
                {entityNode.times.map((time) => (
                  <Badge key={time} variant="time" className="gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    <span>{time}</span>
                  </Badge>
                ))}
              </div>
            )}

            {/* Tags correlacionados */}
            {entityNode?.relatedTags && entityNode.relatedTags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1 mr-1">
                  <Hash className="h-3 w-3" /> Tags vinculados:
                </span>
                {entityNode.relatedTags.map(({ tag, count }) => (
                  <Badge
                    key={tag}
                    variant="tag"
                    onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                    className={`cursor-pointer gap-1 transition-all ${
                      filterTag === tag ? "ring-2 ring-sky-500 font-bold" : "hover:opacity-80"
                    }`}
                  >
                    <span>#{tag}</span>
                    <span className="opacity-60 text-[10px]">({count})</span>
                  </Badge>
                ))}
                {filterTag && (
                  <button
                    onClick={() => setFilterTag(null)}
                    className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 underline"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            )}

            {/* Co-entidades cruzadas (otras entidades que aparecen en los mismos átomos) */}
            {entityNode?.relatedEntities && entityNode.relatedEntities.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1 mr-1">
                  <ArrowRight className="h-3 w-3" /> Co-entidades:
                </span>
                {entityNode.relatedEntities.map(({ entity, count }) => (
                  <Badge
                    key={entity}
                    variant="entity"
                    onClick={() => onSelectEntity?.(entity)}
                    className="cursor-pointer hover:opacity-80 transition-opacity gap-1"
                    title={`Navegar al contexto 360° de @${entity}`}
                  >
                    <span>@{entity}</span>
                    <span className="opacity-60 text-[10px]">({count})</span>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* ============================================================ */}
        {/* CAPTURA RÁPIDA IN-CONTEXT (< 3 SEGUNDOS)                     */}
        {/* ============================================================ */}
        <section
          className={`p-4 border-b ${
            outdoorMode
              ? "border-black bg-white"
              : "border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-900/40"
          }`}
        >
          <form onSubmit={handleQuickSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                type="text"
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                placeholder={`Capturar para ${displayName}: //hoy #materiales...`}
                className={`h-11 font-mono text-sm bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 focus-visible:ring-1 focus-visible:ring-purple-500 ${
                  outdoorMode ? "border-2 border-black text-black font-bold" : ""
                }`}
              />
            </div>
            <Button
              type="submit"
              disabled={!quickInput.trim()}
              className={`h-11 px-4 font-mono font-bold text-xs gap-1.5 shrink-0 transition-transform active:scale-95 ${
                outdoorMode
                  ? "bg-black text-white hover:bg-zinc-800 border-2 border-black"
                  : "bg-purple-600 hover:bg-purple-700 text-white"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Vincular</span>
              <CornerDownLeft className="h-3.5 w-3.5 opacity-70" />
            </Button>
          </form>
          <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono mt-2 px-1">
            <span>Fricción Cero: {displayName} se enlazará automáticamente.</span>
            <span>Enter para capturar</span>
          </div>
        </section>

        {/* ============================================================ */}
        {/* LÍNEA DE TIEMPO DEL HISTORIAL ATÓMICO                        */}
        {/* ============================================================ */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-2 border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                Historial ({displayedAtoms.length})
              </span>
            </div>

            {/* Pestañas de filtrado rápido */}
            <div className="flex items-center gap-1 text-xs font-mono">
              <button
                onClick={() => setActiveFilter("all")}
                className={`px-2 py-0.5 rounded transition-colors ${
                  activeFilter === "all"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setActiveFilter("pending")}
                className={`px-2 py-0.5 rounded transition-colors ${
                  activeFilter === "pending"
                    ? "bg-amber-600 text-white font-bold"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                Pendientes ({entityNode?.pendingCount || 0})
              </button>
              <button
                onClick={() => setActiveFilter("completed")}
                className={`px-2 py-0.5 rounded transition-colors ${
                  activeFilter === "completed"
                    ? "bg-emerald-600 text-white font-bold"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                Completados ({entityNode?.completedCount || 0})
              </button>
            </div>
          </div>

          {displayedAtoms.length === 0 ? (
            <div
              className={`p-10 text-center rounded-xl border-2 border-dashed ${
                outdoorMode
                  ? "border-black text-black bg-zinc-50 font-bold"
                  : "border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500"
              }`}
            >
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-mono">
                No hay átomos vinculados con los filtros actuales.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedAtoms.map((atom) => (
                <div
                  key={atom.id}
                  className={`group p-3.5 rounded-xl transition-all flex items-start gap-3 border ${
                    outdoorMode
                      ? "border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs"
                  } ${atom.completed ? "opacity-60" : ""}`}
                >
                  {/* Botón de alternar completado */}
                  <button
                    type="button"
                    onClick={() => onToggleComplete(atom.id)}
                    className="mt-0.5 text-zinc-400 hover:text-emerald-500 transition-colors"
                    title={atom.completed ? "Marcar pendiente" : "Marcar completado"}
                  >
                    {atom.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Circle className="h-5 w-5 hover:text-zinc-600 dark:hover:text-zinc-200" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p
                      className={`text-sm leading-relaxed break-words font-mono ${
                        atom.completed ? "line-through text-zinc-400 dark:text-zinc-500" : ""
                      }`}
                    >
                      {atom.cleanText || atom.rawText}
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {atom.times?.map((t) => (
                        <Badge key={t} variant="time" className="text-[10px] gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          <span>{t}</span>
                        </Badge>
                      ))}

                      {atom.tags?.map((t) => (
                        <Badge
                          key={t}
                          variant="tag"
                          onClick={() => setFilterTag(filterTag === t ? null : t)}
                          className="cursor-pointer text-[10px] gap-1 hover:opacity-80"
                        >
                          <Hash className="h-2.5 w-2.5" />
                          <span>{t}</span>
                        </Badge>
                      ))}

                      <span className="text-[10px] text-zinc-400 font-mono ml-auto">
                        {atom.timestamp}
                      </span>
                    </div>
                  </div>

                  {/* Eliminar átomo */}
                  <button
                    type="button"
                    onClick={() => onDeleteAtom(atom.id)}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-zinc-400 hover:text-rose-500 transition-all"
                    title="Eliminar átomo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PIE DEL MODAL 360° */}
        <footer
          className={`p-4 border-t flex items-center justify-between text-xs font-mono ${
            outdoorMode
              ? "border-black bg-zinc-100"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 text-zinc-500"
          }`}
        >
          <span>Grafo Gorila Codex • Soberanía Atómica</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs font-mono hover:bg-zinc-200 dark:hover:bg-zinc-800"
          >
            Cerrar Inspector
          </Button>
        </footer>
      </div>
    </div>
  );
}
