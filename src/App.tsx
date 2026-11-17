import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Upload,
  Lightbulb,
  CheckCircle2,
  Volume2,
  VolumeX,
  RotateCcw,
  Trash2,
  Layers,
  AlertTriangle,
  Loader2,
  ChevronRight,
} from "lucide-react";
import {
  CellCoord,
  Grid,
  SAMPLE_PUZZLES,
  cloneGrid,
  countFilledCells,
  createEmptyGrid,
  findConflicts,
  findEasiestNextMove,
  isGridComplete,
  solveSudoku,
} from "./utils/sudoku";
import { optimizeImageForOcr } from "./utils/imageOptimize";
import { ActiveHint, SudokuGrid } from "./components/SudokuGrid";
import { AvatarMood, TutorAvatar } from "./components/TutorAvatar";
import { CameraCaptureModal } from "./components/CameraCaptureModal";
import { ArOverlayModal } from "./components/ArOverlayModal";

export function App() {
  const [initialGrid, setInitialGrid] = useState<Grid>(() =>
    cloneGrid(SAMPLE_PUZZLES[0].grid)
  );
  const [grid, setGrid] = useState<Grid>(() => cloneGrid(SAMPLE_PUZZLES[0].grid));
  const [aiFilledCells, setAiFilledCells] = useState<Set<string>>(() => new Set());
  const [selectedCell, setSelectedCell] = useState<CellCoord | null>({ row: 0, col: 2 });

  // Stato foto & OCR
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrNote, setOcrNote] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stato Tutor & Hint Progressivi
  const [hintLoading, setHintLoading] = useState(false);
  const [activeHint, setActiveHint] = useState<ActiveHint | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Modali
  const [cameraOpen, setCameraOpen] = useState(false);
  const [arOpen, setArOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hintCacheRef = useRef<Map<string, { tecnica: string; spiegazione: string }>>(new Map());
  const hintRequestIdRef = useRef(0);

  const conflicts = useMemo(() => findConflicts(grid), [grid]);
  const filledCount = useMemo(() => countFilledCells(grid), [grid]);
  const completed = useMemo(() => isGridComplete(grid), [grid]);

  // Determina l'espressione della mascotte TutorAvatar
  const avatarMood: AvatarMood = useMemo(() => {
    if (ocrLoading) return "scanning";
    if (hintLoading && activeHint?.level === 3 && !activeHint.spiegazione) return "thinking";
    if (conflicts.size > 0 || errorMessage) return "error";
    if (completed) return "solved";
    if (activeHint) return "hint";
    return "idle";
  }, [ocrLoading, hintLoading, activeHint, conflicts.size, errorMessage, completed]);

  const stopSpeech = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    return () => stopSpeech();
  }, [stopSpeech]);

  const speakText = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setErrorMessage("Il tuo browser non supporta la sintesi vocale (Web Speech API).");
      return;
    }

    if (isSpeaking) {
      stopSpeech();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "it-IT";
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Analisi OCR tramite backend Express -> Gemini Vision
  const runOcr = async (base64: string, mimeType: string, dataUrl: string) => {
    stopSpeech();
    hintRequestIdRef.current++;
    setPhotoDataUrl(dataUrl);
    setOcrLoading(true);
    setErrorMessage(null);
    setOcrNote(null);
    setActiveHint(null);

    try {
      const res = await fetch("/api/sudoku/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });

      const data = (await res.json()) as { grid?: Grid; note?: string; error?: string };
      if (!res.ok || !data.grid) {
        throw new Error(data.error || "Errore durante il riconoscimento della griglia.");
      }

      setInitialGrid(cloneGrid(data.grid));
      setGrid(cloneGrid(data.grid));
      setAiFilledCells(new Set());
      setOcrNote(data.note || "Griglia digitalizzata. Verifica e correggi eventuali cifre prima di iniziare.");
      setSelectedCell({ row: 0, col: 0 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore di connessione durante l'OCR.";
      setErrorMessage(msg);
    } finally {
      setOcrLoading(false);
    }
  };

  // Ridimensiona e comprime l'immagine prima dell'upload per velocizzare l'OCR
  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Seleziona un file immagine valido (JPG, PNG o WEBP).");
      return;
    }

    setErrorMessage(null);
    setOcrLoading(true);
    try {
      const optimized = await optimizeImageForOcr(file, 1024, 0.82);
      await runOcr(optimized.base64, optimized.mimeType, optimized.dataUrl);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Errore durante la preparazione dell'immagine.";
      setErrorMessage(msg);
      setOcrLoading(false);
    }
  };

  // Modifica manuale cella (verifica OCR o gioco)
  const handleCellChange = (row: number, col: number, value: number) => {
    stopSpeech();
    hintRequestIdRef.current++;
    setErrorMessage(null);
    setGrid((prev) => {
      const next = cloneGrid(prev);
      next[row][col] = value;
      return next;
    });
    setAiFilledCells((prev) => {
      const next = new Set(prev);
      next.delete(`${row}-${col}`);
      return next;
    });
    if (activeHint && activeHint.row === row && activeHint.col === col) {
      setActiveHint(null);
    }
  };

  // Suggerisci Mossa:
  // 1) Mostra subito (0ms) il Livello 1 dal solutore locale MRV
  // 2) Scarica in background la spiegazione da Gemini con cache per stato griglia
  const handleRequestHint = async () => {
    stopSpeech();
    setErrorMessage(null);

    if (conflicts.size > 0) {
      setErrorMessage("Correggi prima i conflitti evidenziati in rosso nella griglia.");
      return;
    }

    if (completed) {
      setErrorMessage("Il Sudoku è già completato!");
      return;
    }

    // Se abbiamo già un hint attivo a livello 1 o 2, avanziamo istantaneamente di livello
    if (activeHint && activeHint.level < 3) {
      setActiveHint({
        ...activeHint,
        level: (activeHint.level + 1) as 1 | 2 | 3,
      });
      return;
    }

    const nextMove = findEasiestNextMove(grid);
    if (!nextMove) {
      setErrorMessage(
        "Questa configurazione non ha una soluzione valida. Controlla se c'è un errore di riconoscimento OCR nella griglia."
      );
      return;
    }

    const cacheKey = `${grid.flat().join("")}|${nextMove.row}-${nextMove.col}-${nextMove.value}`;
    const cached = hintCacheRef.current.get(cacheKey);

    setSelectedCell({ row: nextMove.row, col: nextMove.col });

    // Mostra immediatamente Livello 1 a zero latenza!
    setActiveHint({
      row: nextMove.row,
      col: nextMove.col,
      value: nextMove.value,
      tecnica: cached?.tecnica || nextMove.reasonType,
      spiegazione: cached?.spiegazione || "",
      level: 1,
    });

    if (cached) {
      setHintLoading(false);
      return;
    }

    // Avvia la richiesta Gemini in background mentre l'utente legge Livello 1/2
    const requestId = ++hintRequestIdRef.current;
    setHintLoading(true);
    try {
      const res = await fetch("/api/sudoku/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grid,
          targetRow: nextMove.row,
          targetCol: nextMove.col,
          targetValue: nextMove.value,
          candidatesCount: nextMove.candidatesCount,
          reasonType: nextMove.reasonType,
        }),
      });

      const data = (await res.json()) as {
        tecnica?: string;
        spiegazione?: string;
        error?: string;
      };

      if (requestId !== hintRequestIdRef.current) return;

      if (!res.ok || !data.spiegazione) {
        throw new Error(data.error || "Impossibile ottenere la spiegazione dal Tutor.");
      }

      const resolved = {
        tecnica: data.tecnica || nextMove.reasonType,
        spiegazione: data.spiegazione,
      };
      hintCacheRef.current.set(cacheKey, resolved);

      setActiveHint((prev) =>
        prev && prev.row === nextMove.row && prev.col === nextMove.col
          ? { ...prev, tecnica: resolved.tecnica, spiegazione: resolved.spiegazione }
          : prev
      );
    } catch (err) {
      if (requestId !== hintRequestIdRef.current) return;
      const fallbackSpiegazione = `Per esclusione rispetto alle cifre già presenti nella riga ${
        nextMove.row + 1
      }, nella colonna ${nextMove.col + 1} e nel blocco 3×3, l'unico numero valido è ${
        nextMove.value
      }.`;
      setActiveHint((prev) =>
        prev && prev.row === nextMove.row && prev.col === nextMove.col
          ? { ...prev, spiegazione: fallbackSpiegazione }
          : prev
      );
      const msg =
        err instanceof Error ? err.message : "Errore durante la richiesta al Tutor Gemini.";
      setErrorMessage(msg);
    } finally {
      if (requestId === hintRequestIdRef.current) {
        setHintLoading(false);
      }
    }
  };

  const handleApplyHint = () => {
    if (!activeHint) return;
    stopSpeech();
    hintRequestIdRef.current++;
    const { row, col, value } = activeHint;
    setGrid((prev) => {
      const next = cloneGrid(prev);
      next[row][col] = value;
      return next;
    });
    setAiFilledCells((prev) => {
      const next = new Set(prev);
      next.add(`${row}-${col}`);
      return next;
    });
    setActiveHint(null);
  };

  // Risolvi Sudoku (Solutore Backtracking locale 100% esatto)
  const handleSolveAll = () => {
    stopSpeech();
    hintRequestIdRef.current++;
    setErrorMessage(null);
    setActiveHint(null);

    if (conflicts.size > 0) {
      setErrorMessage("Impossibile risolvere: ci sono cifre duplicate in rosso. Correggile prima.");
      return;
    }

    const solved = solveSudoku(grid);
    if (!solved) {
      setErrorMessage(
        "Nessuna soluzione trovata per questa griglia. Verifica che tutti i numeri iniziali siano corretti."
      );
      return;
    }

    const newlyFilled = new Set<string>(aiFilledCells);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] === 0 && solved[r][c] !== 0) {
          newlyFilled.add(`${r}-${c}`);
        }
      }
    }

    setGrid(solved);
    setAiFilledCells(newlyFilled);
  };

  const handleResetToInitial = () => {
    stopSpeech();
    hintRequestIdRef.current++;
    setGrid(cloneGrid(initialGrid));
    setAiFilledCells(new Set());
    setActiveHint(null);
    setErrorMessage(null);
  };

  const handleClearGrid = () => {
    stopSpeech();
    hintRequestIdRef.current++;
    const empty = createEmptyGrid();
    setInitialGrid(cloneGrid(empty));
    setGrid(empty);
    setAiFilledCells(new Set());
    setActiveHint(null);
    setErrorMessage(null);
    setOcrNote(null);
    setPhotoDataUrl(null);
  };

  const loadSample = (sampleIndex: number) => {
    stopSpeech();
    hintRequestIdRef.current++;
    const sample = SAMPLE_PUZZLES[sampleIndex];
    setInitialGrid(cloneGrid(sample.grid));
    setGrid(cloneGrid(sample.grid));
    setAiFilledCells(new Set());
    setActiveHint(null);
    setErrorMessage(null);
    setOcrNote(`Schema di esempio caricato: ${sample.name} (${sample.difficulty}).`);
    setPhotoDataUrl(null);
  };

  const boxIndex = activeHint
    ? Math.floor(activeHint.row / 3) * 3 + Math.floor(activeHint.col / 3) + 1
    : 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      {/* Top Bar Contract: 3 zone pulite */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            AI Sudoku Vision
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#griglia"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Griglia Interattiva
            </a>
            <a
              href="#tutor"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Tutor Logico
            </a>
            <a
              href="#acquisizione"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Acquisizione Foto
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Camera className="w-4 h-4" />
              Scatta Foto
            </button>
          </div>
        </div>
      </header>

      {/* Main Two-Zone Educational Sandbox */}
      <main id="top" className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8 max-w-2xl">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Digitalizza il tuo Sudoku cartaceo e imparane la logica
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
            Carica una foto o inquadra lo schema con la fotocamera: il riconoscimento multimodale estrae la matrice 9×9, ti permette di correggere eventuali cifre e ti guida passo dopo passo fino alla soluzione.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT ZONE: Interactive Stage (Griglia 9x9 + Tastierino) */}
          <section
            id="griglia"
            className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 sm:p-6"
          >
            {/* Metadata bar senza pillole */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-xs text-slate-600 tabular-nums">
                <span className="font-medium text-slate-900">
                  Celle: {filledCount} / 81
                </span>
                <span aria-hidden="true">·</span>
                <span className={conflicts.size > 0 ? "text-red-600 font-semibold" : "text-slate-500"}>
                  Conflitti: {conflicts.size}
                </span>
                {completed && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-700 font-semibold">Schema completato</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetToInitial}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap shrink-0"
                  title="Ripristina lo schema iniziale"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Ripristina
                </button>
                <button
                  type="button"
                  onClick={handleClearGrid}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors whitespace-nowrap shrink-0"
                  title="Svuota tutta la griglia"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Svuota
                </button>
              </div>
            </div>

            {/* Griglia 9x9 */}
            <SudokuGrid
              grid={grid}
              initialGrid={initialGrid}
              aiFilledCells={aiFilledCells}
              conflicts={conflicts}
              selectedCell={selectedCell}
              activeHint={activeHint}
              onSelectCell={setSelectedCell}
              onCellChange={handleCellChange}
            />

            {/* Tastierino numerico per correzione OCR e inserimento rapido */}
            <div className="mt-5 pt-5 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-medium text-slate-500">
                  {selectedCell
                    ? `Cella selezionata: Riga ${selectedCell.row + 1}, Colonna ${selectedCell.col + 1}`
                    : "Seleziona una cella per modificare o inserire una cifra"}
                </span>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    disabled={!selectedCell}
                    onClick={() =>
                      selectedCell && handleCellChange(selectedCell.row, selectedCell.col, num)
                    }
                    className="h-10 font-mono text-base font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg hover:bg-sky-50 hover:border-sky-300 hover:text-sky-800 disabled:opacity-40 transition-colors tabular-nums"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={!selectedCell}
                  onClick={() =>
                    selectedCell && handleCellChange(selectedCell.row, selectedCell.col, 0)
                  }
                  className="h-10 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-700 disabled:opacity-40 transition-colors"
                >
                  Canc
                </button>
              </div>
            </div>
          </section>

          {/* RIGHT ZONE: Control & Concept Deck */}
          <aside className="lg:col-span-5 space-y-6">
            {/* 1. Tutor Logico & Avatar Interattivo */}
            <section
              id="tutor"
              className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5"
            >
              <div className="flex items-start gap-4">
                <TutorAvatar mood={avatarMood} size={56} />
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    Tutor Logico
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                    {ocrLoading
                      ? "Sto analizzando la foto con Gemini Vision per estrarre la matrice 9×9..."
                      : completed
                      ? "Ottimo lavoro! Lo schema è stato completato correttamente senza conflitti."
                      : conflicts.size > 0
                      ? "Ho rilevato uno o più numeri duplicati in rosso. Correggili prima di chiedere aiuto."
                      : ocrNote
                      ? ocrNote
                      : "Chiedi un suggerimento progressivo per capire la prossima mossa, oppure risolvi l'intero schema."}
                  </p>
                </div>
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 p-3.5 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg"
                >
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Area Hint Progressivo (3 Livelli) */}
              {activeHint && (
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between text-xs text-amber-900">
                    <span className="font-semibold">
                      Aiuto Livello {activeHint.level} di 3 · {activeHint.tecnica}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        stopSpeech();
                        setActiveHint(null);
                      }}
                      className="text-amber-700 hover:text-amber-950 font-medium"
                    >
                      Chiudi
                    </button>
                  </div>

                  {activeHint.level === 1 && (
                    <p className="text-sm text-slate-800 leading-relaxed">
                      Concentrati sul <strong>Blocco 3×3 numero {boxIndex}</strong> (evidenziato in giallo sulla griglia): c&apos;è una mossa immediata da scoprire.
                    </p>
                  )}

                  {activeHint.level === 2 && (
                    <p className="text-sm text-slate-800 leading-relaxed">
                      Osserva la cella in{" "}
                      <strong>
                        Riga {activeHint.row + 1}, Colonna {activeHint.col + 1}
                      </strong>
                      . Quale cifra da 1 a 9 può essere inserita qui per esclusione?
                    </p>
                  )}

                  {activeHint.level === 3 && (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-900 leading-relaxed">
                        Inserisci{" "}
                        <strong className="font-mono text-base text-amber-900">
                          {activeHint.value}
                        </strong>{" "}
                        in{" "}
                        <strong>
                          Riga {activeHint.row + 1}, Colonna {activeHint.col + 1}
                        </strong>
                        .{" "}
                        {activeHint.spiegazione ? (
                          activeHint.spiegazione
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-slate-600">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Preparazione spiegazione logica...
                          </span>
                        )}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleApplyHint}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Applica Mossa
                        </button>
                        {activeHint.spiegazione && (
                          <button
                            type="button"
                            onClick={() =>
                              speakText(
                                `Inserisci il numero ${activeHint.value} alla riga ${
                                  activeHint.row + 1
                                }, colonna ${activeHint.col + 1}. ${activeHint.spiegazione}`
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                          >
                            {isSpeaking ? (
                              <>
                                <VolumeX className="w-3.5 h-3.5 text-sky-600" />
                                Ferma Voce
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3.5 h-3.5 text-sky-600" />
                                Ascolta Spiegazione
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {activeHint.level < 3 && (
                    <button
                      type="button"
                      onClick={() =>
                        setActiveHint({
                          ...activeHint,
                          level: (activeHint.level + 1) as 1 | 2 | 3,
                        })
                      }
                      className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900 hover:text-amber-700 transition-colors"
                    >
                      {activeHint.level === 1
                        ? "Livello 2: Mostra la cella esatta"
                        : "Livello 3: Rivela cifra e spiegazione"}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Pulsanti principali di assistenza */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={ocrLoading || completed}
                  onClick={handleRequestHint}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-45 transition-colors whitespace-nowrap shrink-0"
                >
                  <Lightbulb className="w-4 h-4" />
                  {activeHint && activeHint.level < 3
                    ? `Avanza Aiuto (${activeHint.level + 1}/3)`
                    : "Suggerisci Mossa"}
                </button>

                <button
                  type="button"
                  disabled={ocrLoading || completed}
                  onClick={handleSolveAll}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-900 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 disabled:opacity-45 transition-colors whitespace-nowrap shrink-0"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Risolvi Sudoku
                </button>
              </div>

              {photoDataUrl && (
                <button
                  type="button"
                  onClick={() => setArOpen(true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  <Layers className="w-4 h-4" />
                  Apri Overlay Fotografico (AR Lite)
                </button>
              )}
            </section>

            {/* 2. Acquisizione Immagine (Foto / Fotocamera / Esempi) */}
            <section
              id="acquisizione"
              className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
            >
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Acquisizione Immagine (OCR)
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Carica una foto del Sudoku cartaceo o usa la fotocamera per digitalizzarlo automaticamente.
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleFileSelected(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={ocrLoading}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 p-4 text-xs font-medium text-slate-700 bg-slate-50 border border-dashed border-slate-300 rounded-lg hover:bg-sky-50 hover:border-sky-400 hover:text-sky-800 disabled:opacity-50 transition-colors"
                >
                  {ocrLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-sky-600" />
                  ) : (
                    <Upload className="w-5 h-5 text-slate-500" />
                  )}
                  <span>Carica Foto</span>
                </button>

                <button
                  type="button"
                  disabled={ocrLoading}
                  onClick={() => setCameraOpen(true)}
                  className="flex flex-col items-center justify-center gap-2 p-4 text-xs font-medium text-slate-700 bg-slate-50 border border-dashed border-slate-300 rounded-lg hover:bg-sky-50 hover:border-sky-400 hover:text-sky-800 disabled:opacity-50 transition-colors"
                >
                  <Camera className="w-5 h-5 text-slate-500" />
                  <span>Usa Fotocamera</span>
                </button>
              </div>

              {photoDataUrl && (
                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span>Foto acquisita</span>
                    <button
                      type="button"
                      onClick={() => setArOpen(true)}
                      className="text-sky-700 hover:underline font-medium"
                    >
                      Vedi in AR
                    </button>
                  </div>
                  <img
                    src={photoDataUrl}
                    alt="Anteprima foto Sudoku acquisita"
                    referrerPolicy="no-referrer"
                    className="w-full h-36 object-cover rounded-lg border border-slate-200"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-2">
                  Oppure prova subito uno schema di esempio:
                </p>
                <div className="flex flex-wrap gap-2">
                  {SAMPLE_PUZZLES.map((sample, idx) => (
                    <button
                      key={sample.name}
                      type="button"
                      onClick={() => loadSample(idx)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
                    >
                      {sample.name} ({sample.difficulty})
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </aside>
        </div>
      </main>

      {/* Modali Fotocamera e AR Lite */}
      <CameraCaptureModal
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(base64, mimeType, dataUrl) => runOcr(base64, mimeType, dataUrl)}
      />

      <ArOverlayModal
        isOpen={arOpen}
        onClose={() => setArOpen(false)}
        imageUrl={photoDataUrl}
        initialGrid={initialGrid}
        currentGrid={grid}
      />
    </div>
  );
}

export default App;
