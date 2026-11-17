import React, { useEffect, useRef, useState } from "react";
import { Camera, X, RotateCcw } from "lucide-react";

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64: string, mimeType: string, dataUrl: string) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setError(null);

    async function startCamera() {
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera error:", err);
        setError(
          "Impossibile accedere alla fotocamera. Verifica i permessi del browser oppure carica una foto dalla galleria."
        );
      }
    }

    startCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, facingMode]);

  if (!isOpen) return null;

  const handleSnap = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const rawW = video.videoWidth || 1280;
    const rawH = video.videoHeight || 720;
    const maxDim = 1024;
    const scale = Math.min(1, maxDim / Math.max(rawW, rawH));
    const width = Math.round(rawW * scale);
    const height = Math.round(rawH * scale);

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    const base64 = dataUrl.split(",")[1];
    onCapture(base64, "image/jpeg", dataUrl);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Acquisizione fotocamera Sudoku"
    >
      <div className="w-full max-w-xl bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Scatta foto al Sudoku</h2>
            <p className="text-xs text-slate-500">
              Inquadra la griglia 9×9 all&apos;interno del riquadro guida con buona luce.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Chiudi fotocamera"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative bg-slate-950 aspect-[4/3] flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="p-6 text-center max-w-sm">
              <p className="text-sm text-red-300 font-medium mb-2">Fotocamera non disponibile</p>
              <p className="text-xs text-slate-300 leading-relaxed">{error}</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Riquadro guida 9x9 */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
                <div className="w-full max-w-[280px] aspect-square border-2 border-white/85 rounded-md shadow-[0_0_0_9999px_rgba(15,23,42,0.45)] grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }).map((_, idx) => (
                    <div key={idx} className="border border-white/30" />
                  ))}
                </div>
              </div>
            </>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setFacingMode((prev) => (prev === "environment" ? "user" : "environment"))}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
            Cambia camera
          </button>

          <button
            type="button"
            disabled={Boolean(error)}
            onClick={handleSnap}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
          >
            <Camera className="w-4 h-4" />
            Scatta e Analizza
          </button>
        </div>
      </div>
    </div>
  );
};
