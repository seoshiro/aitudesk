import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localesDir = path.join(root, 'src', 'i18n', 'locales');
const localeNames = ['ru', 'en', 'kk'];

function readLocale(name) {
  return JSON.parse(fs.readFileSync(path.join(localesDir, `${name}.json`), 'utf8'));
}

function flatten(value, prefix = '') {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flatten(item, `${prefix}[${index}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) =>
      flatten(item, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

const locales = Object.fromEntries(localeNames.map((name) => [name, readLocale(name)]));
const reference = new Set(flatten(locales.ru));
let hasError = false;

for (const name of localeNames.slice(1)) {
  const current = new Set(flatten(locales[name]));
  const missing = [...reference].filter((key) => !current.has(key));
  const extra = [...current].filter((key) => !reference.has(key));

  if (missing.length || extra.length) {
    hasError = true;
    console.error(`Locale ${name} differs from ru:`);
    if (missing.length) console.error(`  Missing: ${missing.join(', ')}`);
    if (extra.length) console.error(`  Extra: ${extra.join(', ')}`);
  }
}

if (hasError) {
  process.exit(1);
}

console.log(`i18n keys match for ${localeNames.join(', ')}`);
