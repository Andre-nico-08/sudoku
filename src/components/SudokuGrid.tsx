import React from "react";
import { CellCoord, Grid } from "../utils/sudoku";

export interface ActiveHint {
  row: number;
  col: number;
  value: number;
  tecnica: string;
  spiegazione: string;
  level: 1 | 2 | 3; // 1 = blocco 3x3, 2 = cella, 3 = cifra + spiegazione
}

interface SudokuGridProps {
  grid: Grid;
  initialGrid: Grid;
  aiFilledCells: Set<string>;
  conflicts: Set<string>;
  selectedCell: CellCoord | null;
  activeHint: ActiveHint | null;
  onSelectCell: (coord: CellCoord) => void;
  onCellChange: (row: number, col: number, value: number) => void;
}

export const SudokuGrid: React.FC<SudokuGridProps> = ({
  grid,
  initialGrid,
  aiFilledCells,
  conflicts,
  selectedCell,
  activeHint,
  onSelectCell,
  onCellChange,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, r: number, c: number) => {
    if (e.key >= "1" && e.key <= "9") {
      e.preventDefault();
      onCellChange(r, c, Number(e.key));
    } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
      e.preventDefault();
      onCellChange(r, c, 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      onSelectCell({ row: Math.max(0, r - 1), col: c });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onSelectCell({ row: Math.min(8, r + 1), col: c });
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      onSelectCell({ row: r, col: Math.max(0, c - 1) });
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onSelectCell({ row: r, col: Math.min(8, c + 1) });
    }
  };

  const selectedVal =
    selectedCell && grid[selectedCell.row][selectedCell.col] !== 0
      ? grid[selectedCell.row][selectedCell.col]
      : null;

  const hintBoxRow = activeHint ? Math.floor(activeHint.row / 3) : -1;
  const hintBoxCol = activeHint ? Math.floor(activeHint.col / 3) : -1;

  return (
    <div className="w-full max-w-[520px] mx-auto">
      <div
        className="grid grid-cols-9 border-2 border-slate-900 bg-white rounded-lg overflow-hidden shadow-sm aspect-square"
        role="grid"
        aria-label="Griglia Sudoku 9 per 9"
      >
        {grid.map((row, r) =>
          row.map((val, c) => {
            const key = `${r}-${c}`;
            const isSelected = selectedCell?.row === r && selectedCell?.col === c;
            const isSameRowOrCol =
              selectedCell && (selectedCell.row === r || selectedCell.col === c);
            const isSameBox =
              selectedCell &&
              Math.floor(selectedCell.row / 3) === Math.floor(r / 3) &&
              Math.floor(selectedCell.col / 3) === Math.floor(c / 3);
            const isSameNumber = selectedVal !== null && val === selectedVal && !isSelected;

            const isOriginal = initialGrid[r][c] !== 0 && initialGrid[r][c] === val;
            const isAiFilled = aiFilledCells.has(key) && val !== 0;
            const isConflict = conflicts.has(key);

            const isInHintBox =
              activeHint !== null &&
              Math.floor(r / 3) === hintBoxRow &&
              Math.floor(c / 3) === hintBoxCol;
            const isHintTargetCell =
              activeHint !== null &&
              activeHint.level >= 2 &&
              activeHint.row === r &&
              activeHint.col === c;
            const showHintPreviewDigit =
              activeHint !== null &&
              activeHint.level === 3 &&
              activeHint.row === r &&
              activeHint.col === c &&
              val === 0;

            const borderRight =
              c === 2 || c === 5
                ? "border-r-2 border-r-slate-900"
                : c < 8
                ? "border-r border-r-slate-200"
                : "";
            const borderBottom =
              r === 2 || r === 5
                ? "border-b-2 border-b-slate-900"
                : r < 8
                ? "border-b border-b-slate-200"
                : "";

            let bgClass = "bg-white";
            if (isConflict) {
              bgClass = "bg-red-50";
            } else if (isHintTargetCell) {
              bgClass = "bg-amber-100";
            } else if (isSelected) {
              bgClass = "bg-sky-100";
            } else if (isInHintBox) {
              bgClass = "bg-amber-50/70";
            } else if (isSameNumber) {
              bgClass = "bg-sky-50";
            } else if (isAiFilled) {
              bgClass = "bg-emerald-50/60";
            } else if (isSameRowOrCol || isSameBox) {
              bgClass = "bg-slate-50";
            }

            let textClass = "text-slate-900 font-semibold";
            if (isConflict) {
              textClass = "text-red-600 font-bold";
            } else if (isAiFilled) {
              textClass = "text-emerald-700 font-semibold";
            } else if (!isOriginal && val !== 0) {
              textClass = "text-sky-700 font-medium";
            }

            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                aria-label={`Riga ${r + 1}, Colonna ${c + 1}, ${
                  val === 0 ? "vuota" : `valore ${val}`
                }`}
                onClick={() => onSelectCell({ row: r, col: c })}
                onKeyDown={(e) => handleKeyDown(e, r, c)}
                className={`relative flex items-center justify-center text-lg sm:text-2xl font-mono tabular-nums transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-600 ${borderRight} ${borderBottom} ${bgClass} ${textClass} ${
                  isHintTargetCell ? "ring-2 ring-inset ring-amber-500" : ""
                }`}
              >
                {val !== 0 ? (
                  <span>{val}</span>
                ) : showHintPreviewDigit ? (
                  <span className="text-amber-700 font-bold">{activeHint.value}</span>
                ) : null}

                {isConflict && (
                  <span
                    className="absolute top-0.5 right-1 text-[9px] font-sans font-bold text-red-600"
                    aria-hidden="true"
                  >
                    !
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Legenda colori compatta e senza pillole */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="font-mono font-semibold text-slate-900">5</span> Originali / OCR
        </span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="font-mono font-medium text-sky-700">5</span> Modificate da te
        </span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="font-mono font-semibold text-emerald-700">5</span> Inserite dall&apos;AI
        </span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="font-mono font-bold text-red-600">5!</span> Conflitto
        </span>
      </div>
    </div>
  );
};
