import { toBlob } from 'html-to-image';
import { downloadBlob } from './fileAccess';

export const EXPORT_CSS_WIDTH = 1200;
export const EXPORT_PIXEL_RATIO = 2;

function isSafari(): boolean {
  const ua = navigator.userAgent;
  return /Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\//.test(ua);
}

async function waitForImages(node: HTMLElement) {
  const imgs = Array.from(node.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))),
  );
}

/** Ritar elementet till en PNG (2400 px bred) och laddar ned den. */
export async function exportNodeToPng(node: HTMLElement, fileName: string): Promise<Blob> {
  if (document.fonts?.ready) await document.fonts.ready;
  await waitForImages(node);
  const opts = {
    pixelRatio: EXPORT_PIXEL_RATIO,
    width: EXPORT_CSS_WIDTH,
    backgroundColor: '#ffffff',
    cacheBust: false,
  };
  // Safari ritar ibland inte bilder/typsnitt första gången; en extra körning löser det.
  if (isSafari()) await toBlob(node, opts);
  const blob = await toBlob(node, opts);
  if (!blob) throw new Error('Kunde inte skapa bild');
  downloadBlob(blob, fileName);
  return blob;
}

export function pngFileName(year: number, month: number): string {
  return `schema-${year}-${String(month).padStart(2, '0')}.png`;
}
