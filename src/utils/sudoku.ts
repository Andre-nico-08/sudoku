export type Grid = number[][];

export interface CellCoord {
  row: number;
  col: number;
}

export interface NextMoveSuggestion {
  row: number;
  col: number;
  value: number;
  candidatesCount: number;
  reasonType: string;
}

export function createEmptyGrid(): Grid {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => [...row]);
}

export function getCandidates(grid: Grid, row: number, col: number): number[] {
  if (grid[row][col] !== 0) return [];
  const used = new Set<number>();

  for (let i = 0; i < 9; i++) {
    if (grid[row][i] !== 0) used.add(grid[row][i]);
    if (grid[i][col] !== 0) used.add(grid[i][col]);
  }

  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (grid[r][c] !== 0) used.add(grid[r][c]);
    }
  }

  const candidates: number[] = [];
  for (let n = 1; n <= 9; n++) {
    if (!used.has(n)) candidates.push(n);
  }
  return candidates;
}

/**
 * Restituisce un Set di chiavi "r-c" per tutte le celle che violano le regole del Sudoku.
 */
export function findConflicts(grid: Grid): Set<string> {
  const conflicts = new Set<string>();

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const val = grid[r][c];
      if (val === 0) continue;

      // Controllo riga
      for (let cc = 0; cc < 9; cc++) {
        if (cc !== c && grid[r][cc] === val) {
          conflicts.add(`${r}-${c}`);
          conflicts.add(`${r}-${cc}`);
        }
      }

      // Controllo colonna
      for (let rr = 0; rr < 9; rr++) {
        if (rr !== r && grid[rr][c] === val) {
          conflicts.add(`${r}-${c}`);
          conflicts.add(`${rr}-${c}`);
        }
      }

      // Controllo blocco 3x3
      const br = Math.floor(r / 3) * 3;
      const bc = Math.floor(c / 3) * 3;
      for (let rr = br; rr < br + 3; rr++) {
        for (let cc = bc; cc < bc + 3; cc++) {
          if ((rr !== r || cc !== c) && grid[rr][cc] === val) {
            conflicts.add(`${r}-${c}`);
            conflicts.add(`${rr}-${cc}`);
          }
        }
      }
    }
  }

  return conflicts;
}

/**
 * Solutore Backtracking locale con euristica MRV (Minimum Remaining Values).
 * 100% deterministico ed esatto.
 */
export function solveSudoku(inputGrid: Grid): Grid | null {
  if (findConflicts(inputGrid).size > 0) return null;

  const grid = cloneGrid(inputGrid);

  function backtrack(): boolean {
    let bestRow = -1;
    let bestCol = -1;
    let bestCandidates: number[] | null = null;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] === 0) {
          const candidates = getCandidates(grid, r, c);
          if (candidates.length === 0) return false;
          if (!bestCandidates || candidates.length < bestCandidates.length) {
            bestCandidates = candidates;
            bestRow = r;
            bestCol = c;
            if (candidates.length === 1) break;
          }
        }
      }
      if (bestCandidates && bestCandidates.length === 1) break;
    }

    if (bestRow === -1) return true; // Tutte le celle sono piene

    for (const num of bestCandidates!) {
      grid[bestRow][bestCol] = num;
      if (backtrack()) return true;
      grid[bestRow][bestCol] = 0;
    }

    return false;
  }

  return backtrack() ? grid : null;
}

/**
 * Identifica la prossima mossa più semplice ed evidente per il Tutor Ibrido.
 * Priorità:
 * 1. Singolo Nudo (cella con 1 solo candidato possibile)
 * 2. Singolo Nascosto in un blocco 3x3, riga o colonna
 * 3. Cella con il minor numero di candidati (valore preso dalla soluzione esatta)
 */
export function findEasiestNextMove(grid: Grid): NextMoveSuggestion | null {
  const solved = solveSudoku(grid);
  if (!solved) return null;

  // 1. Cerca un Singolo Nudo (Naked Single)
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) {
        const candidates = getCandidates(grid, r, c);
        if (candidates.length === 1) {
          return {
            row: r,
            col: c,
            value: candidates[0],
            candidatesCount: 1,
            reasonType: "Singolo Nudo (unica cifra possibile nella cella)",
          };
        }
      }
    }
  }

  // 2. Cerca un Singolo Nascosto nei blocchi 3x3
  for (let br = 0; br < 9; br += 3) {
    for (let bc = 0; bc < 9; bc += 3) {
      for (let num = 1; num <= 9; num++) {
        let count = 0;
        let lastR = -1;
        let lastC = -1;
        for (let r = br; r < br + 3; r++) {
          for (let c = bc; c < bc + 3; c++) {
            if (grid[r][c] === 0 && getCandidates(grid, r, c).includes(num)) {
              count++;
              lastR = r;
              lastC = c;
            }
          }
        }
        if (count === 1) {
          return {
            row: lastR,
            col: lastC,
            value: num,
            candidatesCount: getCandidates(grid, lastR, lastC).length,
            reasonType: "Singolo Nascosto nel blocco 3×3",
          };
        }
      }
    }
  }

  // 3. Fallback: cella vuota con il minor numero di candidati
  let minCand = 10;
  let target: CellCoord | null = null;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) {
        const len = getCandidates(grid, r, c).length;
        if (len < minCand) {
          minCand = len;
          target = { row: r, col: c };
        }
      }
    }
  }

  if (!target) return null;

  return {
    row: target.row,
    col: target.col,
    value: solved[target.row][target.col],
    candidatesCount: minCand,
    reasonType: "Deduzione avanzata tramite eliminazione incrociata",
  };
}

export function isGridComplete(grid: Grid): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) return false;
    }
  }
  return findConflicts(grid).size === 0;
}

export function countFilledCells(grid: Grid): number {
  let count = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] !== 0) count++;
    }
  }
  return count;
}

export const SAMPLE_PUZZLES: { name: string; difficulty: string; grid: Grid }[] = [
  {
    name: "Classico Quotidiano",
    difficulty: "Facile",
    grid: [
      [5, 3, 0, 0, 7, 0, 0, 0, 0],
      [6, 0, 0, 1, 9, 5, 0, 0, 0],
      [0, 9, 8, 0, 0, 0, 0, 6, 0],
      [8, 0, 0, 0, 6, 0, 0, 0, 3],
      [4, 0, 0, 8, 0, 3, 0, 0, 1],
      [7, 0, 0, 0, 2, 0, 0, 0, 6],
      [0, 6, 0, 0, 0, 0, 2, 8, 0],
      [0, 0, 0, 4, 1, 9, 0, 0, 5],
      [0, 0, 0, 0, 8, 0, 0, 7, 9],
    ],
  },
  {
    name: "Sfida da Settimana Enigmistica",
    difficulty: "Medio",
    grid: [
      [0, 0, 0, 2, 6, 0, 7, 0, 1],
      [6, 8, 0, 0, 7, 0, 0, 9, 0],
      [1, 9, 0, 0, 0, 4, 5, 0, 0],
      [8, 2, 0, 1, 0, 0, 0, 4, 0],
      [0, 0, 4, 6, 0, 2, 9, 0, 0],
      [0, 5, 0, 0, 0, 3, 0, 2, 8],
      [0, 0, 9, 3, 0, 0, 0, 7, 4],
      [0, 4, 0, 0, 5, 0, 0, 3, 6],
      [7, 0, 3, 0, 1, 8, 0, 0, 0],
    ],
  },
];
