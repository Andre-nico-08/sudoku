import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const OCR_MODEL = "gemini-4-hydrogen";
const TUTOR_MODEL = "gemini-3.1-flash-lite";

let cachedAiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY non configurata. Impostala nel file .env o in Settings > Secrets."
    );
  }
  if (!cachedAiClient) {
    cachedAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return cachedAiClient;
}

function normalizeGrid(raw: unknown): number[][] {
  if (!Array.isArray(raw) || raw.length !== 9) {
    throw new Error("La matrice restituita dal modello non ha 9 righe.");
  }
  return raw.map((row) => {
    if (!Array.isArray(row) || row.length !== 9) {
      throw new Error("Una riga della matrice non contiene 9 colonne.");
    }
    return row.map((val) => {
      const n = Number(val);
      if (!Number.isInteger(n) || n < 0 || n > 9) return 0;
      return n;
    });
  });
}

function getBlockingContext(grid: number[][], targetRow: number, targetCol: number) {
  const rowNums = grid[targetRow].filter((n) => n !== 0);
  const colNums = grid.map((r) => r[targetCol]).filter((n) => n !== 0);

  const br = Math.floor(targetRow / 3) * 3;
  const bc = Math.floor(targetCol / 3) * 3;
  const boxNums: number[] = [];
  for (let r = br; r < br + 3; r++) {
    for (let c = bc; c < bc + 3; c++) {
      if (grid[r][c] !== 0) boxNums.push(grid[r][c]);
    }
  }

  return {
    rowNums: Array.from(new Set(rowNums)).sort((a, b) => a - b),
    colNums: Array.from(new Set(colNums)).sort((a, b) => a - b),
    boxNums: Array.from(new Set(boxNums)).sort((a, b) => a - b),
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "15mb" }));

  // Endpoint 1: OCR Multimodale (Foto -> Matrice 9x9 JSON, bassa latenza)
  app.post("/api/sudoku/ocr", async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body as {
        imageBase64?: string;
        mimeType?: string;
      };

      if (!imageBase64 || !mimeType) {
        return res.status(400).json({
          error: "Immagine mancante. Carica una foto o scattala con la fotocamera.",
        });
      }

      const ai = getAiClient();
      const prompt =
        "Estrai la griglia Sudoku 9x9 dall'immagine (0 = cella vuota, 1-9 = cifre presenti, stampate o scritte a mano, dall'alto in basso e da sinistra a destra). " +
        "Aggiungi un breve campo 'note' in italiano sulla nitidezza.";

      const response = await ai.models.generateContent({
        model: OCR_MODEL,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              grid: {
                type: Type.ARRAY,
                description: "Matrice 9x9 del Sudoku (0 per celle vuote, 1-9 per cifre presenti).",
                items: {
                  type: Type.ARRAY,
                  items: { type: Type.INTEGER },
                },
              },
              note: {
                type: Type.STRING,
                description: "Breve nota in italiano sulla qualità del riconoscimento OCR.",
              },
            },
            required: ["grid", "note"],
          },
        },
      });

      const rawText = (response.text ?? "").trim();
      if (!rawText) {
        return res.status(502).json({
          error: "Il modello non ha restituito alcun risultato. Riprova con una foto più nitida.",
        });
      }

      const parsed = JSON.parse(rawText) as { grid?: unknown; note?: string };
      const grid = normalizeGrid(parsed.grid);

      return res.json({
        grid,
        note: parsed.note || "Griglia estratta con successo.",
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Errore sconosciuto durante l'analisi OCR.";
      console.error("[/api/sudoku/ocr] Error:", err);
      return res.status(500).json({ error: message });
    }
  });

  // Endpoint 2: Tutor Logico (Flash Lite ultra-rapido con contesto già precalcolato)
  app.post("/api/sudoku/hint", async (req, res) => {
    try {
      const { grid, targetRow, targetCol, targetValue, candidatesCount, reasonType } =
        req.body as {
          grid?: number[][];
          targetRow?: number;
          targetCol?: number;
          targetValue?: number;
          candidatesCount?: number;
          reasonType?: string;
        };

      if (
        !Array.isArray(grid) ||
        grid.length !== 9 ||
        typeof targetRow !== "number" ||
        typeof targetCol !== "number" ||
        typeof targetValue !== "number"
      ) {
        return res.status(400).json({ error: "Dati della griglia o della mossa non validi." });
      }

      const ai = getAiClient();
      const boxNumber = Math.floor(targetRow / 3) * 3 + Math.floor(targetCol / 3) + 1;
      const { rowNums, colNums, boxNums } = getBlockingContext(grid, targetRow, targetCol);

      const prompt = `Sei un tutor didattico di Sudoku chiaro e sintetico.
Cella obiettivo: Riga ${targetRow + 1}, Colonna ${targetCol + 1} (Blocco 3x3 n.${boxNumber}).
Cifra esatta da inserire: ${targetValue}.
Tecnica: ${reasonType || "Eliminazione diretta"} (candidati possibili: ${candidatesCount ?? 1}).
Numeri già presenti nella Riga ${targetRow + 1}: [${rowNums.join(", ")}].
Numeri già presenti nella Colonna ${targetCol + 1}: [${colNums.join(", ")}].
Numeri già presenti nel Blocco ${boxNumber}: [${boxNums.join(", ")}].

Scrivi in italiano in massimo 2 frasi chiare perché ${targetValue} è l'unica scelta valida per questa cella citando i numeri già presenti che escludono le altre cifre.`;

      const response = await ai.models.generateContent({
        model: TUTOR_MODEL,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tecnica: {
                type: Type.STRING,
                description: "Nome breve della tecnica logica (es. Singolo Nudo, Singolo Nascosto)",
              },
              spiegazione: {
                type: Type.STRING,
                description: "Spiegazione didattica sintetica in italiano (max 2 frasi).",
              },
            },
            required: ["tecnica", "spiegazione"],
          },
        },
      });

      const rawText = (response.text ?? "").trim();
      if (!rawText) {
        return res.status(502).json({ error: "Nessuna spiegazione ricevuta dal modello." });
      }

      const parsed = JSON.parse(rawText) as {
        tecnica: string;
        spiegazione: string;
      };

      return res.json({
        row: targetRow,
        col: targetCol,
        valore: targetValue,
        tecnica: parsed.tecnica || "Deduzione Logica",
        spiegazione: parsed.spiegazione,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Errore durante la generazione del suggerimento.";
      console.error("[/api/sudoku/hint] Error:", err);
      return res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Sudoku Vision & Tutor server running at http://localhost:${PORT}`);
  });
}

startServer();
