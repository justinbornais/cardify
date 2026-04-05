# Cardify

Cardify is a frontend-only Astro + React TypeScript app that generates print-ready, letter-sized sheets containing repeated cards (business cards, game cards, bookmarks, stickers, etc.) from one or two input images or PDFs.

## Features

- Accepts PNG / JPEG / WEBP images and single- or two-page PDFs.
- Front/back support: upload two files or supply a two-page PDF to auto-detect both faces.
- Grid modes: fixed grid (rows × columns), fix columns (specify columns; rows auto-computed), fix rows (specify rows; columns auto-computed).
- Preserves image aspect ratio and fits images inside cells (no unwanted cropping).
- Configurable gutter, page margin, and optional thin cutting guides for trimming.
- Fully client-side - no server or backend required; exports a print-ready PDF.

## Quick start

Prerequisites: Node.js 18+ and npm.

Install and run the dev server:

```bash
npm install
npm run dev
```

Build for production and preview the built output:

```bash
npm run build
npm run preview
```

The production build output is written to `dist/`.

## Usage

1. Open the app in your browser (development server or `npm run preview`).
2. Upload a front image (required). Optionally upload a back image or provide a two-page PDF.
3. Choose a layout mode and set rows/columns or fix rows/cols as desired.
4. Adjust gutter and margin; toggle cutting guides if you want printed trim lines.
5. Click "Generate & Download PDF" - the app produces a letter-size PDF (72 pt/in) ready for printing.

Notes:
- The "Fixed grid" mode uses the front image aspect (when available) to size cells so tiles stack vertically without extra gaps.

## Project structure

- `src/pages/index.astro` - entry page that mounts the client app.
- `src/components/CardifyApp.tsx` - main React UI and client logic.
- `src/utils/imageProcessor.ts` - image / PDF → normalized PNG conversion.
- `src/utils/layoutCalculator.ts` - page/grid math and layout helpers.
- `src/utils/pdfGenerator.ts` - PDF composition.

## Deployment

This repository includes a GitHub Actions workflow that builds the site and publishes `./dist` to the `gh-pages` branch.

- Workflow: `.github/workflows/deploy-gh-pages.yml`

To enable GitHub Pages deployment from this workflow:

1. Push changes to the `main` branch (the workflow triggers on push to `main`).
2. In your repository settings on GitHub, set GitHub Pages to serve from the `gh-pages` branch (root).
3. The workflow will build and publish the site automatically.

You can also deploy manually by publishing the contents of `dist/` to any static host.

## Troubleshooting

- If image uploads or PDF rendering fail in the browser, ensure your files are valid and your browser allows large file handling. PDF pages are rendered client-side via `pdfjs-dist`.
- If the build fails, verify your Node.js version and run `npm install` to restore dependencies.

## Contributing

PRs, issues, and suggestions are welcome. Please open an issue for discussion before large changes.

## License

This repository is licensed under the MIT License. See the LICENSE file for more details.