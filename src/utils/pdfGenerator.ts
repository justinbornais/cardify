import { PDFDocument, rgb, LineCapStyle } from 'pdf-lib';
import type { LayoutResult } from './layoutCalculator';
import type { ProcessedImage } from './imageProcessor';

export interface GeneratePDFOptions {
  layout: LayoutResult;
  front: ProcessedImage;
  back: ProcessedImage | null;
  /** Draw thin cutting guides between cards */
  showCuttingGuides: boolean;
  /**
   * Duplex flip axis.
   * 'long'  → flip on long edge   (left/right binding) - horizontal mirror
   * 'short' → flip on short edge  (top/bottom binding) - vertical mirror
   */
  flipAxis?: 'long' | 'short';
}

/**
 * Draw all card positions for one page.
 * Returns array of {x, y} positions in PDF points (origin = bottom-left).
 */
function cardPositions(layout: LayoutResult): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      const x = layout.marginXPt + col * (layout.cardWidthPt + layout.gutterPt);
      // PDF y=0 is bottom; row 0 is at the top of the grid
      const y =
        layout.pageHeightPt -
        layout.marginYPt -
        (row + 1) * layout.cardHeightPt -
        row * layout.gutterPt;
      positions.push({ x, y });
    }
  }
  return positions;
}

/**
 * Mirror positions for the back page.
 * For flip-on-long-edge (standard duplex), mirror X positions.
 * For flip-on-short-edge, mirror Y positions.
 */
function mirroredPositions(
  layout: LayoutResult,
  flipAxis: 'long' | 'short'
): Array<{ x: number; y: number }> {
  const front = cardPositions(layout);
  if (flipAxis === 'long') {
    // Mirror horizontally: the card at (x) maps to (pageWidth - x - cardWidth)
    return front.map(({ x, y }) => ({
      x: layout.pageWidthPt - x - layout.cardWidthPt,
      y,
    }));
  } else {
    // Mirror vertically: the card at (y) maps to (pageHeight - y - cardHeight)
    return front.map(({ x, y }) => ({
      x,
      y: layout.pageHeightPt - y - layout.cardHeightPt,
    }));
  }
}

/** Draw cutting guide lines around the grid. */
function drawCuttingGuides(
  page: ReturnType<PDFDocument['addPage']>,
  layout: LayoutResult
): void {
  const {
    marginXPt,
    marginYPt,
    cardWidthPt,
    cardHeightPt,
    gutterPt,
    cols,
    rows,
    pageHeightPt,
  } = layout;

  const guideColor = rgb(0.6, 0.6, 0.6);
  const lineWidth = 0.35;
  // Extend guides slightly beyond the grid
  const bleed = 6; // pts ≈ 2 mm

  // Vertical lines (before each column and after the last)
  for (let col = 0; col <= cols; col++) {
    // Left edge of each slot
    const xLine =
      col === 0
        ? marginXPt
        : col === cols
        ? marginXPt + cols * cardWidthPt + (cols - 1) * gutterPt
        : marginXPt + col * (cardWidthPt + gutterPt) - gutterPt / 2;

    page.drawLine({
      start: { x: xLine, y: pageHeightPt - marginYPt + bleed },
      end: { x: xLine, y: marginYPt - bleed },
      thickness: lineWidth,
      color: guideColor,
      lineCap: LineCapStyle.Round,
    });
  }

  // Also draw mid-gutter verticals when gutter > 0
  if (gutterPt > 0) {
    for (let col = 1; col < cols; col++) {
      const xMid = marginXPt + col * cardWidthPt + (col - 0.5) * gutterPt;
      // Only draw center line if gutter is wide enough (> 2 pt)
      if (gutterPt > 2) {
        page.drawLine({
          start: { x: xMid, y: pageHeightPt - marginYPt + bleed },
          end: { x: xMid, y: marginYPt - bleed },
          thickness: lineWidth * 0.5,
          color: rgb(0.75, 0.75, 0.75),
          lineCap: LineCapStyle.Round,
        });
      }
    }
  }

  // Horizontal lines
  for (let row = 0; row <= rows; row++) {
    const yActual =
      row === 0
        ? pageHeightPt - marginYPt
        : row === rows
        ? pageHeightPt - marginYPt - rows * cardHeightPt - (rows - 1) * gutterPt
        : pageHeightPt - marginYPt - row * (cardHeightPt + gutterPt) + gutterPt / 2;

    page.drawLine({
      start: { x: marginXPt - bleed, y: yActual },
      end: { x: marginXPt + cols * cardWidthPt + (cols - 1) * gutterPt + bleed, y: yActual },
      thickness: lineWidth,
      color: guideColor,
      lineCap: LineCapStyle.Round,
    });
  }
}

/**
 * Generate a print-ready PDF.
 *
 * Page 1: front sides of all cards in a grid.
 * Page 2 (if back provided): back sides mirrored for duplex alignment.
 */
export async function generatePrintPDF(options: GeneratePDFOptions): Promise<Uint8Array> {
  const { layout, front, back, showCuttingGuides, flipAxis = 'long' } = options;

  const pdfDoc = await PDFDocument.create();

  // Embed the front image
  const frontPng = await pdfDoc.embedPng(front.pngBytes);

  // ── Front page ──────────────────────────────────────────────────────────────
  const frontPage = pdfDoc.addPage([layout.pageWidthPt, layout.pageHeightPt]);

  const frontPositions = cardPositions(layout);
  for (const { x, y } of frontPositions) {
    // Preserve image aspect ratio and center inside the card cell
    const imgAspect = front.widthPx > 0 && front.heightPx > 0 ? front.widthPx / front.heightPx : 1;
    const slotAspect = layout.cardWidthPt / layout.cardHeightPt;
    let drawW = layout.cardWidthPt;
    let drawH = layout.cardHeightPt;
    if (imgAspect > slotAspect) {
      drawW = layout.cardWidthPt;
      drawH = layout.cardWidthPt / imgAspect;
    } else {
      drawH = layout.cardHeightPt;
      drawW = layout.cardHeightPt * imgAspect;
    }
    const offsetX = x + (layout.cardWidthPt - drawW) / 2;
    const offsetY = y + (layout.cardHeightPt - drawH) / 2;
    frontPage.drawImage(frontPng, {
      x: offsetX,
      y: offsetY,
      width: drawW,
      height: drawH,
    });
  }

  if (showCuttingGuides) {
    drawCuttingGuides(frontPage, layout);
  }

  // ── Back page ────────────────────────────────────────────────────────────────
  if (back) {
    const backPng = await pdfDoc.embedPng(back.pngBytes);
    const backPage = pdfDoc.addPage([layout.pageWidthPt, layout.pageHeightPt]);

    const backPositions = mirroredPositions(layout, flipAxis);
    for (const { x, y } of backPositions) {
      const imgAspect = back.widthPx > 0 && back.heightPx > 0 ? back.widthPx / back.heightPx : 1;
      const slotAspect = layout.cardWidthPt / layout.cardHeightPt;
      let drawW = layout.cardWidthPt;
      let drawH = layout.cardHeightPt;
      if (imgAspect > slotAspect) {
        drawW = layout.cardWidthPt;
        drawH = layout.cardWidthPt / imgAspect;
      } else {
        drawH = layout.cardHeightPt;
        drawW = layout.cardHeightPt * imgAspect;
      }
      const offsetX = x + (layout.cardWidthPt - drawW) / 2;
      const offsetY = y + (layout.cardHeightPt - drawH) / 2;
      backPage.drawImage(backPng, {
        x: offsetX,
        y: offsetY,
        width: drawW,
        height: drawH,
      });
    }

    if (showCuttingGuides) {
      drawCuttingGuides(backPage, layout);
    }
  }

  return pdfDoc.save();
}
