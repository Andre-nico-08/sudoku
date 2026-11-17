export interface OptimizedImage {
  base64: string;
  mimeType: string;
  dataUrl: string;
}

/**
 * Ridimensiona e comprime un'immagine lato client (max 1024px sul lato lungo, JPEG 0.82)
 * per ridurre drasticamente i tempi di upload e di elaborazione multimodale OCR.
 */
export async function optimizeImageForOcr(
  fileOrDataUrl: File | string,
  maxDimension = 1024,
  quality = 0.82
): Promise<OptimizedImage> {
  const sourceUrl =
    typeof fileOrDataUrl === "string"
      ? fileOrDataUrl
      : await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Impossibile leggere il file immagine."));
          reader.readAsDataURL(fileOrDataUrl);
        });

  return new Promise<OptimizedImage>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { naturalWidth: width, naturalHeight: height } = img;

      if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Impossibile elaborare il canvas immagine."));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      const mimeType = "image/jpeg";
      const dataUrl = canvas.toDataURL(mimeType, quality);
      const base64 = dataUrl.split(",")[1] || "";

      resolve({ base64, mimeType, dataUrl });
    };
    img.onerror = () => reject(new Error("Immagine non valida o danneggiata."));
    img.src = sourceUrl;
  });
}
