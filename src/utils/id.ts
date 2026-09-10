export function createId(prefix: string): string {
  const random = crypto.randomUUID();
  return `${prefix}-${random}`;
}

const ACCENT_MAP: Record<string, string> = {
  a: 'aàáâãäå',
  e: 'eèéêë',
  i: 'iìíîï',
  o: 'oòóôõö',
  u: 'uùúûü',
  n: 'nñ',
  c: 'cç',
};

function stripAccents(value: string): string {
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

export function slugify(name: string): string {
  return stripAccents(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
