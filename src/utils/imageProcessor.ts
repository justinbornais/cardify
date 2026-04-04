/**
 * Browser-only image/PDF processing utilities.
 * Returns normalized PNG bytes so pdf-lib can embed them uniformly.
 */

export interface ProcessedImage {
  /** Raw PNG bytes ready for pdf-lib.embedPng() */
  pngBytes: Uint8Array;
  /** Natural width of the source image in pixels */
  widthPx: number;
  /** Natural height of the source image in pixels */
  heightPx: number;
  /** Human-readable label, e.g. "Page 1 of 2" */
  label: string;
}

/** Render a canvas to a PNG Uint8Array. */
function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to convert canvas to PNG'));
        return;
      }
      blob.arrayBuffer().then((ab) => resolve(new Uint8Array(ab))).catch(reject);
    }, 'image/png');
  });
}

/** Convert any image File (PNG / JPEG / WEBP / GIF) to a PNG Uint8Array via canvas. */
async function imageToPng(file: File): Promise<ProcessedImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Failed to load image: ${file.name}`));
      el.src = url;
    });

    // Render at 2× for better PDF quality (max 4000 px on either axis)
    const scale = Math.min(2, 4000 / Math.max(img.naturalWidth, img.naturalHeight, 1));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);

    const pngBytes = await canvasToPng(canvas);
    return { pngBytes, widthPx: w, heightPx: h, label: file.name };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Use pdf.js to render each page of a PDF to a PNG. */
async function pdfToImages(file: File): Promise<ProcessedImage[]> {
  // Lazily import pdfjs-dist to avoid SSR issues
  const pdfjsLib = await import('pdfjs-dist');

  // Point at the CDN worker so Vite doesn't try to bundle it
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const numPages = pdfDoc.numPages;

  const results: ProcessedImage[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    // Render at 200 DPI (≈ 2.78× the default 72-DPI viewport)
    const viewport = page.getViewport({ scale: 2.78 });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx as CanvasRenderingContext2D, viewport }).promise;

    const pngBytes = await canvasToPng(canvas);
    results.push({
      pngBytes,
      widthPx: canvas.width,
      heightPx: canvas.height,
      label: numPages > 1 ? `${file.name} - page ${pageNum}` : file.name,
    });
  }

  return results;
}

/**
 * Process a dropped/selected File into one or two ProcessedImages.
 * - Image files → [front]
 * - Single-page PDF → [front]
 * - Two-page PDF → [front, back]
 * - More pages → only first two are used
 */
export async function processFile(file: File): Promise<ProcessedImage[]> {
  if (file.type === 'application/pdf') {
    const pages = await pdfToImages(file);
    return pages.slice(0, 2);
  }
  const img = await imageToPng(file);
  return [img];
}
