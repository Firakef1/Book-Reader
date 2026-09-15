export type PdfJsEngineSources = {
  pdfJs: string;
  worker: string;
};

// Bundled into the JS pack (JSON), so no Asset.downloadAsync / network fetch.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfJs = require('../../assets/pdfjs/pdf.min.json') as string;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const worker = require('../../assets/pdfjs/pdf.worker.min.json') as string;

let cached: PdfJsEngineSources | null = null;

/**
 * Load Mozilla PDF.js (and its worker) from the app bundle — no network required.
 */
export async function loadPdfJsEngine(): Promise<PdfJsEngineSources> {
  if (cached) return cached;

  if (typeof pdfJs !== 'string' || typeof worker !== 'string') {
    throw new Error('Bundled PDF engine modules did not resolve to source strings.');
  }
  if (!pdfJs.trim() || !worker.trim()) {
    throw new Error('Bundled PDF engine files are empty or unreadable.');
  }

  cached = { pdfJs, worker };
  return cached;
}

/** Escape so minified JS can safely sit inside a <script> tag. */
export function escapeForInlineScript(source: string): string {
  return source.replace(/<\/(script)/gi, '<\\/$1');
}
