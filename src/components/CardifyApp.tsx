'use client';
import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type DragEvent,
  type ChangeEvent,
} from 'react';
import { processFile, type ProcessedImage } from '../utils/imageProcessor';
import {
  calculateGridLayout,
  calculateLayoutWithFixedCols,
  calculateLayoutWithFixedRows,
  type LayoutResult,
} from '../utils/layoutCalculator';
import { generatePrintPDF } from '../utils/pdfGenerator';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UploadedFile {
  file: File;
  previewUrl: string;
  images: ProcessedImage[]; // [front] or [front, back]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function triggerDownload(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface DropzoneProps {
  label: string;
  sublabel?: string;
  uploaded: UploadedFile | null;
  onFile: (f: File) => void;
  onClear: () => void;
  accept?: string;
}

function Dropzone({ label, sublabel, uploaded, onFile, onClear, accept }: DropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFile(file);
      // Reset so the same file can be re-selected
      e.target.value = '';
    },
    [onFile]
  );

  return (
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-slate-700 mb-1">
        {label}
        {sublabel && (
          <span className="ml-1.5 font-normal text-slate-400 text-xs">{sublabel}</span>
        )}
      </p>

      {uploaded ? (
        <div className="relative rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center gap-3">
          {/* Thumbnail */}
          <img
            src={uploaded.previewUrl}
            alt="preview"
            className="h-16 w-16 object-contain rounded-lg border border-slate-200 bg-white flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800 truncate">{uploaded.file.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {uploaded.images.length > 1
                ? `${uploaded.images.length} pages detected`
                : '1 image'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="flex-shrink-0 text-slate-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50"
            aria-label="Remove file"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          className={`rounded-xl border-2 border-dashed transition-colors cursor-pointer p-6 flex flex-col items-center gap-2 select-none
            ${dragging
              ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
              : 'border-slate-300 bg-slate-50 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50/50'
            }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        >
          <svg className="w-8 h-8 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4M8 8l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm font-medium">Drop or click to upload</span>
          <span className="text-xs opacity-70">PNG, JPG, WEBP, PDF</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept ?? 'image/png,image/jpeg,image/webp,application/pdf'}
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}

// ─── Layout Preview Canvas ────────────────────────────────────────────────────

interface PreviewCanvasProps {
  layout: LayoutResult;
  frontImage: ProcessedImage | null;
  backImage: ProcessedImage | null;
}

function PreviewCanvas({ layout, frontImage, backImage }: PreviewCanvasProps) {
  const frontRef = useRef<HTMLCanvasElement>(null);
  const backRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    drawPreview(frontRef.current!, layout, frontImage, false);
  }, [layout, frontImage]);

  useEffect(() => {
    if (backImage) {
      drawPreview(backRef.current!, layout, backImage, true);
    }
  }, [layout, backImage]);

  return (
    <div className={`flex gap-4 justify-center flex-wrap`}>
      <div className="text-center">
        <p className="text-xs font-medium text-slate-500 mb-2">Front (Page 1)</p>
        <canvas
          ref={frontRef}
          className="rounded-lg border border-slate-200 shadow-sm max-w-full"
          style={{ maxHeight: 280 }}
        />
      </div>
      {backImage && (
        <div className="text-center">
          <p className="text-xs font-medium text-slate-500 mb-2">Back (Page 2 - mirrored)</p>
          <canvas
            ref={backRef}
            className="rounded-lg border border-slate-200 shadow-sm max-w-full"
            style={{ maxHeight: 280 }}
          />
        </div>
      )}
    </div>
  );
}

function drawPreview(
  canvas: HTMLCanvasElement,
  layout: LayoutResult,
  image: ProcessedImage | null,
  mirrorX: boolean
) {
  if (!canvas) return;

  const PREVIEW_HEIGHT = 280;
  const aspect = layout.pageWidthPt / layout.pageHeightPt;
  const pw = Math.round(PREVIEW_HEIGHT * aspect);
  const ph = PREVIEW_HEIGHT;

  canvas.width = pw;
  canvas.height = ph;

  const ctx = canvas.getContext('2d')!;
  const scale = ph / layout.pageHeightPt;

  // Page background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pw, ph);

  // Draw each card slot
  const drawCard = (x: number, y: number) => {
    const cx = x * scale;
    // PDF y-origin is bottom; canvas y-origin is top
    const cy = ph - (y + layout.cardHeightPt) * scale;
    const cw = layout.cardWidthPt * scale;
    const ch = layout.cardHeightPt * scale;
    return { cx, cy, cw, ch };
  };

  const positions: Array<{ cx: number; cy: number; cw: number; ch: number }> = [];
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      const pdfX = layout.marginXPt + col * (layout.cardWidthPt + layout.gutterPt);
      const pdfY =
        layout.pageHeightPt -
        layout.marginYPt -
        (row + 1) * layout.cardHeightPt -
        row * layout.gutterPt;

      let displayX = pdfX;
      if (mirrorX) {
        displayX = layout.pageWidthPt - pdfX - layout.cardWidthPt;
      }

      positions.push(drawCard(displayX, pdfY));
    }
  }

  if (image) {
    const img = new Image();
    img.onload = () => {
      for (const { cx, cy, cw, ch } of positions) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx, cy, cw, ch);
        ctx.clip();
        // Fit image inside card slot preserving aspect ratio (contain)
        const imgAspect = img.width / img.height;
        const cardAspect = cw / ch;
        let drawW = cw, drawH = ch;
        if (imgAspect > cardAspect) {
          drawW = cw;
          drawH = cw / imgAspect;
        } else {
          drawH = ch;
          drawW = ch * imgAspect;
        }
        const dx = cx + (cw - drawW) / 2;
        const dy = cy + (ch - drawH) / 2;
        ctx.drawImage(img, dx, dy, drawW, drawH);
        ctx.restore();
        // Border
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(cx, cy, cw, ch);
      }
    };
    img.src = URL.createObjectURL(
      new Blob([image.pngBytes.buffer as ArrayBuffer], { type: 'image/png' })
    );
  } else {
    for (const { cx, cy, cw, ch } of positions) {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(cx, cy, cw, ch);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(cx, cy, cw, ch);
    }
  }

  // Page border
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, pw, ph);
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function CardifyApp() {
  // File state
  const [frontUpload, setFrontUpload] = useState<UploadedFile | null>(null);
  const [backUpload, setBackUpload] = useState<UploadedFile | null>(null);

  // Card config
  // Grid config
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [layoutMode, setLayoutMode] = useState<'fixedGrid' | 'fixedCols' | 'fixedRows'>('fixedGrid');

  // Options
  const [gutter, setGutter] = useState(0);
  const [margin, setMargin] = useState(0.25);
  const [showCuttingGuides, setShowCuttingGuides] = useState(false);
  

  // Derived state
  const [layout, setLayout] = useState<LayoutResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine front/back images from uploaded files
  const frontImage: ProcessedImage | null =
    frontUpload?.images[0] ?? null;

  // Back image comes from: back upload (first image), OR second page of front PDF
  const backImage: ProcessedImage | null =
    backUpload?.images[0] ??
    (frontUpload?.images.length === 2 ? frontUpload.images[1] : null);

  // Recalculate layout whenever card dimensions / gutter / margin change
  useEffect(() => {
    try {
      let l: LayoutResult;
      const aspect = frontImage ? frontImage.widthPx / frontImage.heightPx : 1;
      if (layoutMode === 'fixedGrid') {
        const aspectForGrid = frontImage ? frontImage.widthPx / frontImage.heightPx : undefined;
        l = calculateGridLayout(rows, cols, orientation, gutter, margin, aspectForGrid);
      } else if (layoutMode === 'fixedCols') {
        l = calculateLayoutWithFixedCols(cols, orientation, aspect, gutter, margin);
      } else {
        l = calculateLayoutWithFixedRows(rows, orientation, aspect, gutter, margin);
      }
      setLayout(l);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Layout error');
      setLayout(null);
    }
  }, [layoutMode, rows, cols, orientation, gutter, margin, frontImage]);

  // Handle file uploads
  const handleFrontFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    setError(null);
    try {
      const images = await processFile(file);
      const url = URL.createObjectURL(file);
      setFrontUpload({ file, previewUrl: url, images });
      // If PDF had 2 pages, clear any separate back upload since we have what we need
      if (images.length === 2) setBackUpload(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to process file');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleBackFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    setError(null);
    try {
      const images = await processFile(file);
      const url = URL.createObjectURL(file);
      setBackUpload({ file, previewUrl: url, images });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to process file');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const clearFront = useCallback(() => {
    if (frontUpload) URL.revokeObjectURL(frontUpload.previewUrl);
    setFrontUpload(null);
  }, [frontUpload]);

  const clearBack = useCallback(() => {
    if (backUpload) URL.revokeObjectURL(backUpload.previewUrl);
    setBackUpload(null);
  }, [backUpload]);

  // Generate PDF
  const handleGenerate = useCallback(async () => {
    if (!frontImage || !layout) return;
    setIsGenerating(true);
    setError(null);
    try {
      const bytes = await generatePrintPDF({
        layout,
        front: frontImage,
        back: backImage,
        showCuttingGuides,
      });
      triggerDownload(bytes, 'cardify-print.pdf');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  }, [frontImage, backImage, layout, showCuttingGuides]);

  const canGenerate = !!frontImage && !!layout;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="7" width="18" height="10" rx="2" />
              <path d="M3 11h18" strokeWidth="1.5" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-none">Cardify</h1>
            <p className="text-xs text-slate-500 mt-0.5">Bulk card print sheet generator</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* ── Step 1: Upload ──────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <SectionTitle number={1} title="Upload Images" />
          <p className="text-sm text-slate-500 mb-4">
            Upload a front image (required). Optionally upload a back image for two-sided printing.
            A two-page PDF automatically provides both faces.
          </p>

          <div className="flex gap-4 flex-col sm:flex-row">
            <Dropzone
              label="Front Face"
              sublabel="required"
              uploaded={frontUpload}
              onFile={handleFrontFile}
              onClear={clearFront}
            />
            <Dropzone
              label="Back Face"
              sublabel={
                frontUpload?.images.length === 2
                  ? 'auto-detected from PDF'
                  : 'optional'
              }
              uploaded={
                backUpload ??
                (frontUpload?.images.length === 2
                  ? { file: frontUpload.file, previewUrl: frontUpload.previewUrl, images: [frontUpload.images[1]] }
                  : null)
              }
              onFile={handleBackFile}
              onClear={clearBack}
            />
          </div>

          {isProcessing && (
            <div className="mt-3 flex items-center gap-2 text-indigo-600 text-sm">
              <Spinner /> Processing file...
            </div>
          )}

          {/* Two-page PDF note */}
          {frontUpload?.images.length === 2 && (
            <p className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              Two pages detected in your PDF - page 1 will be used as the front, page 2 as the back.
            </p>
          )}
        </section>

        {/* ── Step 2: Grid & Orientation ─────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <SectionTitle number={2} title="Grid & Orientation" />
          <p className="text-sm text-slate-500 mb-4">Choose how many tiles per page and the page orientation.</p>

          <div className="flex gap-3 mb-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700 mr-2">Mode</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLayoutMode('fixedGrid')}
                  className={`py-1.5 px-3 rounded-lg border text-sm ${layoutMode === 'fixedGrid' ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200'}`}>
                  Fixed grid
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('fixedCols')}
                  className={`py-1.5 px-3 rounded-lg border text-sm ${layoutMode === 'fixedCols' ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200'}`}>
                  Fix columns
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('fixedRows')}
                  className={`py-1.5 px-3 rounded-lg border text-sm ${layoutMode === 'fixedRows' ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200'}`}>
                  Fix rows
                </button>
              </div>
            </div>

            <div className="ml-auto">
              <label className="block text-sm font-medium text-slate-700 mb-1">Orientation</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOrientation('portrait')}
                  className={`py-2 px-3 rounded-lg border text-sm font-medium ${orientation === 'portrait' ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200'}`}>
                  Portrait
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation('landscape')}
                  className={`py-2 px-3 rounded-lg border text-sm font-medium ${orientation === 'landscape' ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200'}`}>
                  Landscape
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rows</label>
              <input
                type="number"
                min={1}
                max={50}
                value={rows}
                disabled={layoutMode === 'fixedCols'}
                onChange={(e) => setRows(Math.max(1, Number(e.target.value) || 1))}
                className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Columns</label>
              <input
                type="number"
                min={1}
                max={50}
                value={cols}
                disabled={layoutMode === 'fixedRows'}
                onChange={(e) => setCols(Math.max(1, Number(e.target.value) || 1))}
                className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-60"
              />
            </div>

            <div className="ml-auto flex items-center gap-3 text-sm text-slate-500">
              {layoutMode === 'fixedCols' && !frontImage && (
                <span>Upload an image to compute rows.</span>
              )}
              {layoutMode === 'fixedCols' && layout && (
                <span>Computed rows: <strong className="text-slate-700">{layout.rows}</strong></span>
              )}
              {layoutMode === 'fixedRows' && layout && (
                <span>Computed columns: <strong className="text-slate-700">{layout.cols}</strong></span>
              )}
            </div>
          </div>
        </section>

        {/* ── Step 3: Options ─────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <SectionTitle number={3} title="Print Options" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Gutter / Bleed Space
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={0.5}
                  step={0.0625}
                  value={gutter}
                  onChange={(e) => setGutter(Number(e.target.value))}
                  className="flex-1 accent-indigo-600"
                />
                <span className="text-sm font-mono text-slate-600 w-14 text-right">
                  {gutter === 0 ? 'none' : `${gutter.toFixed(4).replace(/\.?0+$/, '')}"` }
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Space between cards for cutting</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Page Margin
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={0.5}
                  step={0.0625}
                  value={margin}
                  onChange={(e) => setMargin(Number(e.target.value))}
                  className="flex-1 accent-indigo-600"
                />
                <span className="text-sm font-mono text-slate-600 w-14 text-right">
                  {margin === 0 ? 'none' : `${margin.toFixed(4).replace(/\.?0+$/, '')}"` }
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Minimum unprintable border</p>
            </div>

            <div className="flex items-center gap-3">
              <input
                id="cutting-guides"
                type="checkbox"
                checked={showCuttingGuides}
                onChange={(e) => setShowCuttingGuides(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 accent-indigo-600"
              />
              <div>
                <label htmlFor="cutting-guides" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Show cutting guides
                </label>
                <p className="text-xs text-slate-400">Prints thin lines between cards</p>
              </div>
            </div>
            
          </div>
        </section>

        {/* ── Layout Summary ──────────────────────────────────────────────── */}
        {layout && (
          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <SectionTitle number={4} title="Layout" />

            <div className="mb-4">
              <p className="text-2xl font-bold">{layout.totalCards}<span className="text-sm font-normal ml-2">tiles/sheet</span></p>
              <p className="text-xs text-slate-500 mt-1">{layout.cols} × {layout.rows} grid - {layout.orientation}</p>
            </div>

            <PreviewCanvas
              layout={layout}
              frontImage={frontImage}
              backImage={backImage}
            />

            {backImage && (
              <p className="text-xs text-slate-500 text-center mt-3">
                Back page is mirrored for duplex printing (long-edge).
              </p>
            )}
          </section>
        )}

        {/* ── Error ──────────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-start gap-2">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
            </svg>
            {error}
          </div>
        )}

        {/* ── Generate Button ─────────────────────────────────────────────── */}
        <div className="flex justify-center pb-8">
          <button
            type="button"
            disabled={!canGenerate || isGenerating}
            onClick={handleGenerate}
            className={`flex items-center gap-2.5 px-8 py-3.5 rounded-2xl text-base font-semibold shadow-lg transition-all
              ${
                canGenerate && !isGenerating
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-xl active:scale-95 shadow-indigo-200'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
          >
            {isGenerating ? (
              <>
                <Spinner className="text-white" />
                Generating PDF...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4M16 14l-4 4-4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {!frontImage ? 'Upload an image to continue' : 'Generate & Download PDF'}
              </>
            )}
          </button>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white/80">
        <div className="max-w-5xl mx-auto px-4 py-4 text-sm text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>© 2026 Justin Bornais</div>
          <div>Runs entirely in your browser - no files are uploaded or sent to any server.</div>
        </div>
      </footer>

    </div>
  );
}

// ─── Small reusable atoms ─────────────────────────────────────────────────────

function SectionTitle({ number, title }: { number: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
        {number}
      </span>
      <h2 className="text-base font-semibold text-slate-900" dangerouslySetInnerHTML={{ __html: title }} />
    </div>
  );
}

// Removed unused LabeledInput helper (grid inputs implemented directly)

function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`w-4 h-4 animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  );
}
