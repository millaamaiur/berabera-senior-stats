import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const logoPath = fileURLToPath(new URL('../LogoBeraBera.png', import.meta.url));
const out = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));

async function squareTransparent(size, dest) {
  await sharp(logoPath)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(dest);
}

async function squareOnWhite(size, dest, scale = 1) {
  const inner = Math.round(size * scale);
  const resized = await sharp(logoPath)
    .resize(inner, inner, { fit: 'inside' })
    .toBuffer();
  const meta = await sharp(resized).metadata();
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite([{ input: resized, left: Math.round((size - meta.width) / 2), top: Math.round((size - meta.height) / 2) }])
    .png()
    .toFile(dest);
}

await squareTransparent(64, out('favicon-64.png'));
await squareTransparent(192, out('pwa-192.png'));
await squareTransparent(512, out('pwa-512.png'));
await squareOnWhite(180, out('apple-touch-icon.png'));
await squareOnWhite(512, out('pwa-maskable-512.png'), 0.72);

console.log('done');
