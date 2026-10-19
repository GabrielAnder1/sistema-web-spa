// =========================================================
// Utilidades varias: CSV parser (auto-delimitador + BOM),
// limpieza de encabezados vacíos, formato, escapes.
// =========================================================

import { CONFIG } from './config.js';

/**
 * Parser CSV robusto:
 * - Elimina BOM (\uFEFF) al inicio.
 * - Auto-detecta separador (',' vs ';').
 * - Soporta comillas dobles con escape ("") y saltos dentro de celdas.
 */
export function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  const firstLine = (text.split(/\r?\n/, 1)[0] || '');
  const commas = (firstLine.match(/,/g) || []).length;
  const semis  = (firstLine.match(/;/g) || []).length;
  const delim  = semis > commas ? ';' : ',';

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === delim) { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* ignorar */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v && v.trim() !== ''));
}

/**
 * Convierte filas CSV en objetos usando los nombres de columna del header.
 * Ignora columnas cuyo encabezado esté vacío (celdas fantasma del Sheet).
 * Si hay encabezados duplicados, el segundo se renombra con sufijo _2, _3...
 */
export function csvToObjects(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];

  const rawHeader = (rows[0] || []).map(h => (h || '').trim());

  // Índices de columnas con encabezado no vacío
  const validIdx = [];
  rawHeader.forEach((h, i) => { if (h !== '') validIdx.push(i); });

  // Detectar duplicados y renombrar
  const seen = Object.create(null);
  const headerName = rawHeader.map(h => {
    if (!h) return null;
    if (seen[h]) { seen[h]++; return `${h}_${seen[h]}`; }
    seen[h] = 1;
    return h;
  });

  return rows.slice(1).map(r => {
    const obj = {};
    validIdx.forEach(i => {
      const name = headerName[i];
      if (!name) return;
      obj[name] = (r[i] ?? '').trim();
    });
    return obj;
  });
}

/** Normaliza una clave: sin acentos, sin espacios extra, minúsculas. */
export function normKey(s = '') {
  return String(s)
    .replace(/^\uFEFF/, '')
    .trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Busca un valor en un objeto por nombre de columna de forma flexible:
 * insensible a acentos, mayúsculas y espacios sobrantes.
 */
export function pick(row, canonicalName) {
  if (!row || !canonicalName) return '';
  if (canonicalName in row) return row[canonicalName];
  const target = normKey(canonicalName);
  for (const key of Object.keys(row)) {
    if (normKey(key) === target) return row[key];
  }
  return '';
}

/** Formatea precio según CONFIG. */
export function formatPrice(value) {
  const n = parsePrice(value);
  if (Number.isNaN(n)) return value || '';
  return new Intl.NumberFormat(CONFIG.LOCALE, {
    style: 'currency',
    currency: CONFIG.CURRENCY,
    maximumFractionDigits: 2
  }).format(n);
}

/** Extrae número de un string tipo "$25", "25,00", "25 USD". */
export function parsePrice(value) {
  if (value == null) return NaN;
  if (typeof value === 'number') return value;
  let s = String(value).replace(/[^\d.,-]/g, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(',', '.');
  return parseFloat(s);
}

/** Escapa texto para insertarlo en HTML. */
export function escapeHTML(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Genera slug simple para IDs DOM. */
export function slug(str = '') {
  return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Debounce simple. */
export function debounce(fn, ms = 200) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}