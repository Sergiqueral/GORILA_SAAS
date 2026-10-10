"use client";

import React, { useState, useMemo } from "react";
import {
  ParsedAtom,
  ensureAtomSchedule,
  formatDateToISO,
  AtomTimeSchedule,
} from "@/lib/omnibarParser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  AtSign,
  Hash,
  CheckCircle2,
  Circle,
  Plus,
  Filter,
  Sun,
  LayoutGrid,
  ListOrdered,
  CalendarDays,
  CalendarRange,
  CornerDownLeft,
  Edit2,
  X,
  Check,
} from "lucide-react";

export type TimeAxis = "recordDate" | "createdAt" | "updatedAt";
export type CalendarViewMode = "month" | "day";

interface AtomicCalendarProps {
  atoms: ParsedAtom[];
  outdoorMode?: boolean;
  onToggleComplete: (atomId: string) => void;
  onSelectEntity: (entityKey: string) => void;
  onQuickCapture: (rawText: string) => void;
  onUpdateAtomSchedule?: (atomId: string, newSchedule: AtomTimeSchedule) => void;
}

export function AtomicCalendar({
  atoms,
  outdoorMode = false,
  onToggleComplete,
  onSelectEntity,
  onQuickCapture,
  onUpdateAtomSchedule,
}: AtomicCalendarProps) {
  // Estados de navegación y vista
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(formatDateToISO(new Date()));
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [timeAxis, setTimeAxis] = useState<TimeAxis>("recordDate");

  // Estado para edición rápida de fecha/hora de un átomo
  const [editingAtom, setEditingAtom] = useState<ParsedAtom | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editIsAllDay, setEditIsAllDay] = useState(true);

  // Input de captura rápida para el día seleccionado
  const [dayCaptureText, setDayCaptureText] = useState("");

  // Nombres de meses y días en español
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  // Helper para extraer la fecha comparativa según el eje temporal activo
  const getAtomDateKey = (atom: ParsedAtom): string => {
    if (timeAxis === "recordDate") {
      return ensureAtomSchedule(atom).recordDate;
    } else if (timeAxis === "createdAt") {
      return formatDateToISO(new Date(atom.createdAt));
    } else {
      return formatDateToISO(new Date(atom.updatedAt || atom.createdAt));
    }
  };

  // Mapeo agrupado de átomos por fecha "YYYY-MM-DD"
  const atomsByDate = useMemo(() => {
    const map = new Map<string, ParsedAtom[]>();
    for (const atom of atoms) {
      const dateKey = getAtomDateKey(atom);
      const list = map.get(dateKey) || [];
      list.push(atom);
      map.set(dateKey, list);
    }
    return map;
  }, [atoms, timeAxis]);

  // Navegación de mes / día
  const prevPeriod = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - 1);
      setSelectedDate(formatDateToISO(d));
    }
  };

  const nextPeriod = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + 1);
      setSelectedDate(formatDateToISO(d));
    }
  };

  const jumpToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(formatDateToISO(today));
  };

  // Cálculo de la cuadrícula mensual (Lunes a Domingo)
  const monthGridDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Ajuste para que la semana empiece en Lunes (0 = Lun, 6 = Dom)
    let firstDayIndex = firstDay.getDay() - 1;
    if (firstDayIndex === -1) firstDayIndex = 6;

    const daysInMonth = lastDay.getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Días del mes anterior para rellenar la primera semana
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const d = new Date(year, month - 1, dayNum);
      days.push({
        dateStr: formatDateToISO(d),
        dayNum,
        isCurrentMonth: false,
      });
    }

    // Días del mes actual
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push({
        dateStr: formatDateToISO(d),
        dayNum: i,
        isCurrentMonth: true,
      });
    }

    // Días del mes siguiente para completar cuadrícula de 35 o 42 celdas
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({
        dateStr: formatDateToISO(d),
        dayNum: i,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentDate]);

  // Átomos del día seleccionado
  const selectedDayAtoms = useMemo(() => {
    return atomsByDate.get(selectedDate) || [];
  }, [atomsByDate, selectedDate]);

  // Desglose del día seleccionado: Todo el día vs Franjas Horarias
  const { allDayAtoms, hourlyAtoms } = useMemo(() => {
    const allDay: ParsedAtom[] = [];
    const hourly: ParsedAtom[] = [];

    for (const atom of selectedDayAtoms) {
      const sched = ensureAtomSchedule(atom);
      if (sched.isAllDay || !sched.startTime) {
        allDay.push(atom);
      } else {
        hourly.push(atom);
      }
    }

    // Ordenar horario por hora de inicio
    hourly.sort((a, b) => {
      const sA = ensureAtomSchedule(a).startTime || "00:00";
      const sB = ensureAtomSchedule(b).startTime || "00:00";
      return sA.localeCompare(sB);
    });

    return { allDayAtoms: allDay, hourlyAtoms: hourly };
  }, [selectedDayAtoms]);

  // Manejo de captura rápida en el día
  const handleDayCapture = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = dayCaptureText.trim();
    if (!trimmed) return;

    // Si no contiene fecha, inyectamos la fecha seleccionada
    const hasTimeToken = /\/\/([^\s]+)/.test(trimmed);
    const finalRaw = hasTimeToken ? trimmed : `${trimmed} //${selectedDate}`;

    onQuickCapture(finalRaw);
    setDayCaptureText("");
  };

  // Abrir editor de fecha/hora de un átomo
  const openEditSchedule = (atom: ParsedAtom) => {
    const sched = ensureAtomSchedule(atom);
    setEditingAtom(atom);
    setEditDate(sched.recordDate);
    setEditIsAllDay(sched.isAllDay);
    setEditStartTime(sched.startTime || "09:00");
    setEditEndTime(sched.endTime || "10:00");
  };

  const saveEditSchedule = () => {
    if (!editingAtom || !onUpdateAtomSchedule) return;
    const newSchedule: AtomTimeSchedule = {
      recordDate: editDate,
      isAllDay: editIsAllDay,
      startTime: editIsAllDay ? undefined : editStartTime,
      endTime: editIsAllDay ? undefined : editEndTime,
    };
    onUpdateAtomSchedule(editingAtom.id, newSchedule);
    setEditingAtom(null);
  };

  // Lista de horas operativas (07:00 a 20:00)
  const operationalHours = Array.from({ length: 14 }, (_, i) => {
    const hour = i + 7;
    return `${String(hour).padStart(2, "0")}:00`;
  });

  const todayIso = formatDateToISO(new Date());

  return (
    <div
      className={`rounded-2xl transition-all duration-200 border flex flex-col ${
        outdoorMode
          ? "bg-white text-black border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] font-mono font-bold"
          : "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-800 shadow-sm"
      }`}
    >
      {/* ============================================================ */}
      {/* CABECERA & BARRA DE CONTROL DEL CALENDARIO                   */}
      {/* ============================================================ */}
      <header
        className={`p-4 sm:p-5 border-b flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
          outdoorMode
            ? "border-b-4 border-black bg-zinc-100"
            : "border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/40"
        }`}
      >
        {/* Navegación de Período */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={prevPeriod}
              className={`p-1.5 rounded-lg border transition-colors ${
                outdoorMode
                  ? "border-black bg-white hover:bg-black hover:text-white"
                  : "border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
              }`}
              title="Período anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={nextPeriod}
              className={`p-1.5 rounded-lg border transition-colors ${
                outdoorMode
                  ? "border-black bg-white hover:bg-black hover:text-white"
                  : "border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
              }`}
              title="Período siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <h2 className="text-lg sm:text-xl font-bold font-mono tracking-tight flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-amber-500" />
            {viewMode === "month"
              ? `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
              : `Día: ${selectedDate}`}
          </h2>

          <Button
            variant="outline"
            size="sm"
            onClick={jumpToToday}
            className={`h-7 px-2.5 text-xs font-mono font-semibold ${
              outdoorMode
                ? "border-black bg-white text-black hover:bg-zinc-200"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            Hoy
          </Button>
        </div>

        {/* Controles de Vista & Eje Temporal */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
          {/* Selector de Eje Temporal (Filtros) */}
          <div className="flex items-center gap-1 text-xs font-mono">
            <span className="text-[11px] text-zinc-400 flex items-center gap-1 mr-1">
              <Filter className="h-3 w-3" /> Eje:
            </span>
            <button
              onClick={() => setTimeAxis("recordDate")}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                timeAxis === "recordDate"
                  ? outdoorMode
                    ? "bg-black text-white font-bold"
                    : "bg-purple-600 text-white font-semibold"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200"
              }`}
              title="Fecha del Registro (Operativa real programada)"
            >
              Registro
            </button>
            <button
              onClick={() => setTimeAxis("createdAt")}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                timeAxis === "createdAt"
                  ? outdoorMode
                    ? "bg-black text-white font-bold"
                    : "bg-sky-600 text-white font-semibold"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200"
              }`}
              title="Fecha de Creación (Cuándo se capturó)"
            >
              Creación
            </button>
            <button
              onClick={() => setTimeAxis("updatedAt")}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                timeAxis === "updatedAt"
                  ? outdoorMode
                    ? "bg-black text-white font-bold"
                    : "bg-emerald-600 text-white font-semibold"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200"
              }`}
              title="Fecha de Edición (Última mutación)"
            >
              Edición
            </button>
          </div>

          {/* Toggle de Modo: Mes vs Franjas Horarias */}
          <div
            className={`flex items-center p-0.5 rounded-lg border ${
              outdoorMode
                ? "border-black bg-white"
                : "border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900"
            }`}
          >
            <button
              onClick={() => setViewMode("month")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono transition-all ${
                viewMode === "month"
                  ? outdoorMode
                    ? "bg-black text-white font-bold"
                    : "bg-white dark:bg-zinc-800 shadow-xs text-zinc-900 dark:text-zinc-100 font-bold"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Mes</span>
            </button>

            <button
              onClick={() => setViewMode("day")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono transition-all ${
                viewMode === "day"
                  ? outdoorMode
                    ? "bg-black text-white font-bold"
                    : "bg-white dark:bg-zinc-800 shadow-xs text-zinc-900 dark:text-zinc-100 font-bold"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <ListOrdered className="h-3.5 w-3.5" />
              <span>Franja Horaria</span>
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* VISTA A: CUADRÍCULA MENSUAL (7X5/6)                         */}
      {/* ============================================================ */}
      {viewMode === "month" && (
        <div className="p-3 sm:p-5 flex-1 flex flex-col">
          {/* Cabecera de días de la semana */}
          <div className="grid grid-cols-7 gap-1 text-center font-mono text-xs font-bold text-zinc-400 dark:text-zinc-500 pb-2 border-b border-zinc-200 dark:border-zinc-800">
            {dayNames.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Celdas del Mes */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 pt-2 flex-1 auto-rows-fr">
            {monthGridDays.map(({ dateStr, dayNum, isCurrentMonth }) => {
              const dayAtoms = atomsByDate.get(dateStr) || [];
              const isSelected = selectedDate === dateStr;
              const isToday = todayIso === dateStr;

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`min-h-[90px] sm:min-h-[110px] p-1.5 sm:p-2 rounded-xl border flex flex-col justify-between transition-all cursor-pointer ${
                    outdoorMode
                      ? isSelected
                        ? "border-3 border-black bg-zinc-200 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                        : "border-2 border-black bg-white hover:bg-zinc-50"
                      : isSelected
                      ? "border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/40 dark:bg-purple-950/20"
                      : isCurrentMonth
                      ? "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700"
                      : "border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-950/40 opacity-40 hover:opacity-80"
                  }`}
                >
                  {/* Número de Día y Badges de Estado */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs sm:text-sm font-mono font-bold px-1.5 py-0.5 rounded-md ${
                        isToday
                          ? outdoorMode
                            ? "bg-black text-white"
                            : "bg-purple-600 text-white"
                          : "text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {dayNum}
                    </span>

                    {dayAtoms.length > 0 && (
                      <span
                        className={`text-[10px] font-mono px-1 rounded-full ${
                          outdoorMode
                            ? "bg-black text-white"
                            : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        {dayAtoms.length}
                      </span>
                    )}
                  </div>

                  {/* Previsualización Compacta de Átomos (Máximo 3) */}
                  <div className="space-y-1 my-1 overflow-hidden">
                    {dayAtoms.slice(0, 3).map((atom) => {
                      const sched = ensureAtomSchedule(atom);
                      return (
                        <div
                          key={atom.id}
                          className={`text-[10px] sm:text-[11px] truncate px-1.5 py-0.5 rounded font-mono flex items-center gap-1 ${
                            atom.completed ? "line-through opacity-50" : ""
                          } ${
                            outdoorMode
                              ? "bg-zinc-100 border border-black text-black"
                              : sched.isAllDay
                              ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                              : "bg-amber-100/80 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300/40"
                          }`}
                          title={atom.cleanText || atom.rawText}
                        >
                          {!sched.isAllDay && sched.startTime && (
                            <Clock className="h-2.5 w-2.5 shrink-0 text-amber-600 dark:text-amber-400" />
                          )}
                          <span className="truncate">
                            {!sched.isAllDay && sched.startTime ? `${sched.startTime} ` : ""}
                            {atom.cleanText || atom.rawText}
                          </span>
                        </div>
                      );
                    })}

                    {dayAtoms.length > 3 && (
                      <span className="text-[9px] font-mono text-zinc-400 px-1">
                        +{dayAtoms.length - 3} más...
                      </span>
                    )}
                  </div>

                  {/* Indicador de Selección Rápida */}
                  <div className="text-[10px] text-zinc-400 font-mono text-right opacity-0 hover:opacity-100">
                    Ver día →
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* VISTA B: FRANJA HORARIA DEL DÍA SELECCIONADO                 */}
      {/* ============================================================ */}
      {viewMode === "day" && (
        <div className="p-4 sm:p-6 space-y-6 flex-1">
          {/* Header del Día */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-zinc-200 dark:border-zinc-800">
            <div>
              <span className="text-xs uppercase font-mono tracking-wider text-zinc-400">
                Agenda de Operaciones
              </span>
              <h3 className="text-xl sm:text-2xl font-bold font-mono">
                {selectedDate}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode("month")}
                className="text-xs font-mono"
              >
                ← Volver al Mes
              </Button>
            </div>
          </div>

          {/* SECCIÓN 1: EVENTOS "TODO EL DÍA" */}
          <div
            className={`p-4 rounded-xl border ${
              outdoorMode
                ? "border-2 border-black bg-zinc-50"
                : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40"
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-mono uppercase font-bold text-zinc-500 flex items-center gap-1.5">
                <CalendarRange className="h-3.5 w-3.5 text-purple-600" />
                Todo el Día ({allDayAtoms.length})
              </span>
              <span className="text-[11px] text-zinc-400 font-mono">
                Tareas y registros sin horario fijo
              </span>
            </div>

            {allDayAtoms.length === 0 ? (
              <p className="text-xs font-mono text-zinc-400 italic">
                Sin átomos asignados a &quot;todo el día&quot; para esta fecha.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {allDayAtoms.map((atom) => (
                  <div
                    key={atom.id}
                    className={`p-3 rounded-lg border flex items-start gap-2.5 transition-all ${
                      outdoorMode
                        ? "border-black bg-white"
                        : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs"
                    } ${atom.completed ? "opacity-50" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => onToggleComplete(atom.id)}
                      className="mt-0.5 text-zinc-400 hover:text-emerald-500"
                    >
                      {atom.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs font-mono break-words ${
                          atom.completed ? "line-through text-zinc-400" : ""
                        }`}
                      >
                        {atom.cleanText || atom.rawText}
                      </p>

                      <div className="flex flex-wrap items-center gap-1 pt-1.5">
                        {atom.entities.map((e) => (
                          <Badge
                            key={e}
                            variant="entity"
                            className="text-[10px] cursor-pointer hover:opacity-80"
                            onClick={() => onSelectEntity(e)}
                          >
                            <AtSign className="h-2.5 w-2.5 mr-0.5" />
                            {e}
                          </Badge>
                        ))}
                        {atom.tags.map((t) => (
                          <Badge key={t} variant="tag" className="text-[10px]">
                            <Hash className="h-2.5 w-2.5 mr-0.5" />
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => openEditSchedule(atom)}
                      className="p-1 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                      title="Editar fecha/hora"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECCIÓN 2: LIENZO DE FRANJAS HORARIAS */}
          <div className="space-y-1">
            <span className="text-xs font-mono uppercase font-bold text-zinc-500 flex items-center gap-1.5 mb-2">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              Línea de Franjas Horarias (Jornada Operativa)
            </span>

            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-200 dark:divide-zinc-800">
              {operationalHours.map((hourStr) => {
                const hourNum = parseInt(hourStr.split(":")[0], 10);
                // Átomos que inician en esta hora
                const matchingAtoms = hourlyAtoms.filter((atom) => {
                  const s = ensureAtomSchedule(atom);
                  if (!s.startTime) return false;
                  const atomHour = parseInt(s.startTime.split(":")[0], 10);
                  return atomHour === hourNum;
                });

                return (
                  <div
                    key={hourStr}
                    className="flex min-h-[56px] hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40 transition-colors group"
                  >
                    {/* Columna de Hora */}
                    <div className="w-16 sm:w-20 p-2 sm:p-2.5 font-mono text-xs text-zinc-400 border-r border-zinc-200 dark:border-zinc-800 flex items-center justify-center shrink-0">
                      {hourStr}
                    </div>

                    {/* Contenedor de Átomos en esta Franja */}
                    <div className="flex-1 p-2 flex flex-wrap items-center gap-2">
                      {matchingAtoms.map((atom) => {
                        const sched = ensureAtomSchedule(atom);
                        return (
                          <div
                            key={atom.id}
                            className={`p-2 rounded-lg border text-xs font-mono flex items-center gap-2 transition-all ${
                              outdoorMode
                                ? "border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                : "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 shadow-xs"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => onToggleComplete(atom.id)}
                            >
                              {atom.completed ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <Circle className="h-4 w-4 text-zinc-400" />
                              )}
                            </button>

                            <div className="flex items-center gap-1.5 font-semibold">
                              <Badge variant="time" className="text-[10px] gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                <span>
                                  {sched.startTime}
                                  {sched.endTime ? ` - ${sched.endTime}` : ""}
                                </span>
                              </Badge>

                              <span className={atom.completed ? "line-through opacity-60" : ""}>
                                {atom.cleanText || atom.rawText}
                              </span>
                            </div>

                            {atom.entities.map((e) => (
                              <Badge
                                key={e}
                                variant="entity"
                                className="cursor-pointer text-[10px]"
                                onClick={() => onSelectEntity(e)}
                              >
                                @{e}
                              </Badge>
                            ))}

                            <button
                              onClick={() => openEditSchedule(atom)}
                              className="ml-auto p-1 text-zinc-400 hover:text-zinc-800"
                              title="Modificar franja"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}

                      {/* Botón rápido para capturar en esta hora */}
                      {matchingAtoms.length === 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setDayCaptureText(`//${selectedDate} //${hourStr} `);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-[11px] font-mono text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center gap-1 px-2 py-1 rounded"
                        >
                          <Plus className="h-3 w-3" /> Capturar a las {hourStr}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CAPTURA RÁPIDA IN-CALENDAR PARA EL DÍA SELECCIONADO          */}
      {/* ============================================================ */}
      <footer
        className={`p-4 border-t flex flex-col sm:flex-row items-center gap-3 ${
          outdoorMode
            ? "border-t-4 border-black bg-zinc-100"
            : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60"
        }`}
      >
        <div className="text-xs font-mono text-zinc-500 whitespace-nowrap">
          Programar para <strong className="text-zinc-800 dark:text-zinc-200">{selectedDate}</strong>:
        </div>

        <form onSubmit={handleDayCapture} className="flex-1 flex gap-2 w-full">
          <Input
            type="text"
            value={dayCaptureText}
            onChange={(e) => setDayCaptureText(e.target.value)}
            placeholder={`Captura: Hormigonado @central //10:00-12:00 #urgente...`}
            className={`h-10 text-xs sm:text-sm font-mono bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 ${
              outdoorMode ? "border-2 border-black text-black font-bold" : ""
            }`}
          />
          <Button
            type="submit"
            disabled={!dayCaptureText.trim()}
            className={`h-10 px-4 font-mono font-bold text-xs gap-1 shrink-0 ${
              outdoorMode
                ? "bg-black text-white hover:bg-zinc-800 border-2 border-black"
                : "bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900"
            }`}
          >
            <span>Agendar</span>
            <CornerDownLeft className="h-3.5 w-3.5 opacity-70" />
          </Button>
        </form>
      </footer>

      {/* ============================================================ */}
      {/* MODAL DE EDICIÓN RÁPIDA DE FECHA/HORA                        */}
      {/* ============================================================ */}
      {editingAtom && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-0"
        >
          <div
            className={`w-full max-w-md p-6 rounded-2xl shadow-2xl border space-y-4 ${
              outdoorMode
                ? "bg-white text-black border-4 border-black font-mono font-bold"
                : "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h4 className="text-base font-bold font-mono flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-purple-600" />
                Editar Fecha / Franja Horaria
              </h4>
              <button
                onClick={() => setEditingAtom(null)}
                className="p-1 text-zinc-400 hover:text-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-500 font-mono italic truncate">
              &ldquo;{editingAtom.cleanText || editingAtom.rawText}&rdquo;
            </p>

            {/* Selector de Fecha */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-semibold text-zinc-500">
                Fecha del Registro (Operativa):
              </label>
              <Input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            {/* Toggle Todo el Día */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="editAllDay"
                checked={editIsAllDay}
                onChange={(e) => setEditIsAllDay(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="editAllDay" className="text-xs font-mono cursor-pointer">
                Todo el día (sin franja horaria específica)
              </label>
            </div>

            {/* Franja Horaria (si no es todo el día) */}
            {!editIsAllDay && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-zinc-500">Hora Inicio:</label>
                  <Input
                    type="time"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-mono text-zinc-500">Hora Fin (opcional):</label>
                  <Input
                    type="time"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingAtom(null)}
                className="text-xs font-mono"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={saveEditSchedule}
                className="text-xs font-mono font-bold bg-purple-600 hover:bg-purple-700 text-white gap-1"
              >
                <Check className="h-3.5 w-3.5" />
                Guardar Cambios
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
