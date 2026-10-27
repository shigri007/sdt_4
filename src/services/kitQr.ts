import QRCode from 'qrcode';
import { TAB_PATHS } from '../access.js';

/**
 * Full link to a kit's trace page on the site the user is currently using
 * (Railway or Vercel), so a phone camera can open it directly.
 */
export const kitTraceUrl = (kitCode: string, origin: string = window.location.origin): string =>
  new URL(`${TAB_PATHS.traceability}/${encodeURIComponent(kitCode)}`, origin).href;

/** QR image (data URL) that encodes the kit's full trace link. */
export const kitQrDataUrl = (kitCode: string): Promise<string> =>
  QRCode.toDataURL(kitTraceUrl(kitCode), {
    margin: 1,
    width: 240,
    color: { dark: '#0F172A', light: '#FFFFFF' },
  });
