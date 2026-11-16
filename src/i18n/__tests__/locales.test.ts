import el from '../locales/el.json';
import en from '../locales/en.json';

type Tree = { [key: string]: unknown };

/** Flattens a nested locale object into `{ 'a.b.c': value }`. */
function flatten(tree: Tree, prefix = ''): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      for (const [k, v] of flatten(value as Tree, path)) out.set(k, v);
    } else {
      out.set(path, value);
    }
  }
  return out;
}

const placeholders = (text: string) =>
  [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort();

const locales = { el: flatten(el), en: flatten(en) };

describe('locale files', () => {
  it('el.json and en.json have exactly the same keys', () => {
    const elKeys = [...locales.el.keys()];
    const enKeys = [...locales.en.keys()];
    expect({ missingInEl: enKeys.filter((k) => !locales.el.has(k)) }).toEqual({ missingInEl: [] });
    expect({ missingInEn: elKeys.filter((k) => !locales.en.has(k)) }).toEqual({ missingInEn: [] });
  });

  it.each(Object.entries(locales))('%s.json has only non-empty string values', (_, entries) => {
    const bad = [...entries].filter(([, v]) => typeof v !== 'string' || v.trim() === '');
    expect(bad).toEqual([]);
  });

  it('uses the same {{placeholders}} in both languages', () => {
    const mismatched = [...locales.en].filter(
      ([key, text]) =>
        JSON.stringify(placeholders(String(text))) !==
        JSON.stringify(placeholders(String(locales.el.get(key) ?? ''))),
    );
    expect(mismatched.map(([key]) => key)).toEqual([]);
  });
});

describe('flatten (test helper)', () => {
  it('reports a key that exists in only one file', () => {
    const a = flatten({ x: { y: '1', z: '2' } });
    const b = flatten({ x: { y: '1' } });
    expect([...a.keys()].filter((k) => !b.has(k))).toEqual(['x.z']);
  });
});
