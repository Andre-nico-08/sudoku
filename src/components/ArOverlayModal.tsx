import React, { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { Grid } from "../utils/sudoku";

interface ArOverlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  initialGrid: Grid;
  currentGrid: Grid;
}

export const ArOverlayModal: React.FC<ArOverlayModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  initialGrid,
  currentGrid,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [padX, setPadX] = useState(8); // percentuale margine orizzontale
  const [padY, setPadY] = useState(8); // percentuale margine verticale
  const [fontScale, setFontScale] = useState(65); // percentuale dimensione font nella cella

  useEffect(() => {
    if (!isOpen || !imageUrl || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      // 1. Disegna la foto originale
      ctx.drawImage(img, 0, 0);

      // 2. Calcola area della griglia 9x9
      const marginX = (canvas.width * padX) / 100;
      const marginY = (canvas.height * padY) / 100;
      const gridW = canvas.width - marginX * 2;
      const gridH = canvas.height - marginY * 2;
      const cellW = gridW / 9;
      const cellH = gridH / 9;

      // 3. Disegna leggera griglia di riferimento AR
      ctx.strokeStyle = "rgba(5, 150, 105, 0.35)";
      ctx.lineWidth = Math.max(1, canvas.width * 0.002);
      ctx.strokeRect(marginX, marginY, gridW, gridH);

      // 4. Disegna i numeri mancanti (inseriti dall'AI o dall'utente) sopra la foto
      const fontSize = Math.floor(Math.min(cellW, cellH) * (fontScale / 100));
      ctx.font = `700 ${fontSize}px "IBM Plex Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const val = currentGrid[r][c];
          const wasOriginal = initialGrid[r][c] !== 0;
          if (val !== 0 && !wasOriginal) {
            const cx = marginX + c * cellW + cellW / 2;
            const cy = marginY + r * cellH + cellH / 2;

            // Alone leggero per massima leggibilità su carta
            ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
            ctx.beginPath();
            ctx.arc(cx, cy, Math.min(cellW, cellH) * 0.36, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#047857";
            ctx.fillText(String(val), cx, cy + fontSize * 0.04);
          }
        }
      }
    };
    img.src = imageUrl;
  }, [isOpen, imageUrl, initialGrid, currentGrid, padX, padY, fontScale]);

  if (!isOpen || !imageUrl) return null;

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "sudoku-risolto-ar.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Overlay Fotografico AR"
    >
      <div className="w-full max-w-3xl bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Overlay Fotografico (AR Lite)</h2>
            <p className="text-xs text-slate-500">
              I numeri risolti vengono proiettati direttamente sulla tua foto originale. Regola i margini per allinearli.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Chiudi overlay AR"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <div className="md:col-span-2 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center">
            <canvas ref={canvasRef} className="max-w-full max-h-[55vh] h-auto block" />
          </div>

          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1.5">
                <label htmlFor="ar-padx">Margine orizzontale</label>
                <span className="font-mono tabular-nums text-slate-500">{padX}%</span>
              </div>
              <input
                id="ar-padx"
                type="range"
                min={0}
                max={30}
                value={padX}
                onChange={(e) => setPadX(Number(e.target.value))}
                className="w-full accent-sky-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1.5">
                <label htmlFor="ar-pady">Margine verticale</label>
                <span className="font-mono tabular-nums text-slate-500">{padY}%</span>
              </div>
              <input
                id="ar-pady"
                type="range"
                min={0}
                max={30}
                value={padY}
                onChange={(e) => setPadY(Number(e.target.value))}
                className="w-full accent-sky-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1.5">
                <label htmlFor="ar-font">Dimensione cifre</label>
                <span className="font-mono tabular-nums text-slate-500">{fontScale}%</span>
              </div>
              <input
                id="ar-font"
                type="range"
                min={35}
                max={95}
                value={fontScale}
                onChange={(e) => setFontScale(Number(e.target.value))}
                className="w-full accent-sky-600"
              />
            </div>

            <button
              type="button"
              onClick={handleDownload}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Scarica Foto Risolta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
