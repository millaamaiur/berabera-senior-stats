import { readdirSync, mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const srcDir = fileURLToPath(new URL('../Capturas Jugadores', import.meta.url));
const destDir = fileURLToPath(new URL('../public/players', import.meta.url));
mkdirSync(destDir, { recursive: true });

const ACCENT_MAP = {
  a: 'aàáâãäå',
  e: 'eèéêë',
  i: 'iìíîï',
  o: 'oòóôõö',
  u: 'uùúûü',
  n: 'nñ',
  c: 'cç',
};

function stripAccents(value) {
  let result = '';
  for (const char of value.toLowerCase()) {
    let replaced = char;
    for (const plain of Object.keys(ACCENT_MAP)) {
      if (ACCENT_MAP[plain].includes(char)) {
        replaced = plain;
        break;
      }
    }
    result += replaced;
  }
  return result;
}

function slugify(name) {
  return stripAccents(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const files = readdirSync(srcDir).filter((f) => f.toLowerCase().endsWith('.png'));

for (const file of files) {
  const name = file.replace(/\.png$/i, '');
  const slug = slugify(name);
  copyFileSync(`${srcDir}/${file}`, `${destDir}/${slug}.png`);
  console.log(`${file} -> players/${slug}.png`);
}
