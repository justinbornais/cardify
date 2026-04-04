/** All units are inches unless noted. */

export interface LayoutResult {
  orientation: 'portrait' | 'landscape';
  /** Whether the card itself was rotated 90° to fit more on the page */
  cardRotated: boolean;
  cols: number;
  rows: number;
  totalCards: number;
  /** Card width on the page in PDF points (may differ from CardConfig if rotated) */
  cardWidthPt: number;
  /** Card height on the page in PDF points */
  cardHeightPt: number;
  gutterPt: number;
  marginXPt: number;
  marginYPt: number;
  pageWidthPt: number;
  pageHeightPt: number;
}

const LETTER_W_IN = 8.5;
const LETTER_H_IN = 11;
const PT_PER_INCH = 72;

/**
 * Calculate a fixed rows × cols grid layout for a US Letter page.
 * Each grid cell size is computed (in points) and the grid centered on the page.
 */
export function calculateGridLayout(
  rows: number,
  cols: number,
  orientation: 'portrait' | 'landscape',
  gutterInches = 0,
  marginInches = 0.25,
  imageAspect?: number
): LayoutResult {
  const pageW = orientation === 'portrait' ? LETTER_W_IN : LETTER_H_IN;
  const pageH = orientation === 'portrait' ? LETTER_H_IN : LETTER_W_IN;

  const availW = pageW - 2 * marginInches;
  const availH = pageH - 2 * marginInches;

  if (availW <= 0 || availH <= 0) {
    throw new Error('Invalid page margins.');
  }

  const totalGutterW = Math.max(0, cols - 1) * gutterInches;
  const totalGutterH = Math.max(0, rows - 1) * gutterInches;

  let cellW: number;
  let cellH: number;

  // If an image aspect is provided, attempt to size cells to that aspect
  // so the images fill the vertical space of each cell without extra
  // letterboxing, similar to fixed-cols/fixed-rows behavior.
  if (imageAspect && imageAspect > 0) {
    // Try basing cell size on available width
    const candidateCellW = (availW - totalGutterW) / Math.max(1, cols);
    const candidateCellH = candidateCellW / imageAspect;
    const gridHUsingWidth = rows * candidateCellH + (rows - 1) * gutterInches;

    if (gridHUsingWidth <= availH) {
      cellW = candidateCellW;
      cellH = candidateCellH;
    } else {
      // Otherwise, try basing on available height
      const candidateCellH2 = (availH - totalGutterH) / Math.max(1, rows);
      const candidateCellW2 = candidateCellH2 * imageAspect;
      const gridWUsingHeight = cols * candidateCellW2 + (cols - 1) * gutterInches;
      if (gridWUsingHeight <= availW) {
        cellW = candidateCellW2;
        cellH = candidateCellH2;
      } else {
        // Fallback: distribute evenly across both dimensions
        cellW = (availW - totalGutterW) / Math.max(1, cols);
        cellH = (availH - totalGutterH) / Math.max(1, rows);
      }
    }
  } else {
    // No aspect provided: distribute available space evenly
    cellW = (availW - totalGutterW) / Math.max(1, cols);
    cellH = (availH - totalGutterH) / Math.max(1, rows);
  }

  if (cellW <= 0 || cellH <= 0) {
    throw new Error('Grid does not fit on the page with the current margins/gutter.');
  }

  const gridW = cols * cellW + (cols - 1) * gutterInches;
  const gridH = rows * cellH + (rows - 1) * gutterInches;

  const marginX = (pageW - gridW) / 2;
  const marginY = (pageH - gridH) / 2;

  return {
    orientation,
    cardRotated: false,
    cols,
    rows,
    totalCards: rows * cols,
    cardWidthPt: cellW * PT_PER_INCH,
    cardHeightPt: cellH * PT_PER_INCH,
    gutterPt: gutterInches * PT_PER_INCH,
    marginXPt: marginX * PT_PER_INCH,
    marginYPt: marginY * PT_PER_INCH,
    pageWidthPt: pageW * PT_PER_INCH,
    pageHeightPt: pageH * PT_PER_INCH,
  };
}

/**
 * Given a fixed number of columns and the image aspect ratio, compute
 * the largest integer number of rows that fit on the page when each
 * cell is sized to the column width while preserving aspect ratio.
 */
export function calculateLayoutWithFixedCols(
  cols: number,
  orientation: 'portrait' | 'landscape',
  imageAspect: number,
  gutterInches = 0,
  marginInches = 0.25
): LayoutResult {
  const pageW = orientation === 'portrait' ? LETTER_W_IN : LETTER_H_IN;
  const pageH = orientation === 'portrait' ? LETTER_H_IN : LETTER_W_IN;

  const availW = pageW - 2 * marginInches;
  const availH = pageH - 2 * marginInches;

  if (cols < 1) throw new Error('Columns must be at least 1');

  const totalGutterW = Math.max(0, cols - 1) * gutterInches;
  const cellW = (availW - totalGutterW) / cols;
  if (cellW <= 0) throw new Error('Not enough horizontal space for columns');

  const cellH = cellW / (imageAspect || 1);
  if (cellH <= 0) throw new Error('Computed cell height invalid');

  const rows = Math.floor((availH + gutterInches) / (cellH + gutterInches));
  if (rows < 1) throw new Error('No rows fit on the page with this column count and image aspect');

  const gridW = cols * cellW + (cols - 1) * gutterInches;
  const gridH = rows * cellH + (rows - 1) * gutterInches;
  const marginX = (pageW - gridW) / 2;
  const marginY = (pageH - gridH) / 2;

  return {
    orientation,
    cardRotated: false,
    cols,
    rows,
    totalCards: rows * cols,
    cardWidthPt: cellW * PT_PER_INCH,
    cardHeightPt: cellH * PT_PER_INCH,
    gutterPt: gutterInches * PT_PER_INCH,
    marginXPt: marginX * PT_PER_INCH,
    marginYPt: marginY * PT_PER_INCH,
    pageWidthPt: pageW * PT_PER_INCH,
    pageHeightPt: pageH * PT_PER_INCH,
  };
}

/**
 * Given a fixed number of rows and the image aspect ratio, compute
 * the largest integer number of columns that fit on the page when each
 * cell is sized to the row height while preserving aspect ratio.
 */
export function calculateLayoutWithFixedRows(
  rows: number,
  orientation: 'portrait' | 'landscape',
  imageAspect: number,
  gutterInches = 0,
  marginInches = 0.25
): LayoutResult {
  const pageW = orientation === 'portrait' ? LETTER_W_IN : LETTER_H_IN;
  const pageH = orientation === 'portrait' ? LETTER_H_IN : LETTER_W_IN;

  const availW = pageW - 2 * marginInches;
  const availH = pageH - 2 * marginInches;

  if (rows < 1) throw new Error('Rows must be at least 1');

  const totalGutterH = Math.max(0, rows - 1) * gutterInches;
  const cellH = (availH - totalGutterH) / rows;
  if (cellH <= 0) throw new Error('Not enough vertical space for rows');

  const cellW = cellH * (imageAspect || 1);
  if (cellW <= 0) throw new Error('Computed cell width invalid');

  const cols = Math.floor((availW + gutterInches) / (cellW + gutterInches));
  if (cols < 1) throw new Error('No columns fit on the page with this row count and image aspect');

  const gridW = cols * cellW + (cols - 1) * gutterInches;
  const gridH = rows * cellH + (rows - 1) * gutterInches;
  const marginX = (pageW - gridW) / 2;
  const marginY = (pageH - gridH) / 2;

  return {
    orientation,
    cardRotated: false,
    cols,
    rows,
    totalCards: rows * cols,
    cardWidthPt: cellW * PT_PER_INCH,
    cardHeightPt: cellH * PT_PER_INCH,
    gutterPt: gutterInches * PT_PER_INCH,
    marginXPt: marginX * PT_PER_INCH,
    marginYPt: marginY * PT_PER_INCH,
    pageWidthPt: pageW * PT_PER_INCH,
    pageHeightPt: pageH * PT_PER_INCH,
  };
}
