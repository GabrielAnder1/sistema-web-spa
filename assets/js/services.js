// =========================================================
// Carga el CSV de servicios, normaliza y renderiza el grid.
// - Mapeo flexible de columnas (sin acentos/mayúsculas).
// - Incluye servicios "No Disponible" con badge y botón deshabilitado.
// =========================================================

import { CONFIG } from './config.js';
import { csvToObjects, formatPrice, escapeHTML, pick, parsePrice, normKey } from './utils.js';
import { addToCart } from './cart.js';

let _services = [];
let _activeCategory = '__all__';

/** Estados que marcan un servicio como NO disponible. */
const UNAVAILABLE_STATES = ['no disponible', 'nodisponible', 'inactivo', 'inactiva', 'disabled'];

/** Descarga y normaliza el catálogo. */
export async function loadServices() {
  const statusEl  = document.getElementById('services-status');
  const gridEl    = document.getElementById('services-grid');
  const filtersEl = document.getElementById('filters');

  try {
    const res = await fetch(CONFIG.SERVICES_CSV, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    // --- Diagnóstico ---
    console.log('[services] Raw CSV (primeros 400 chars):', JSON.stringify(text.slice(0, 400)));

    const raw = csvToObjects(text);

    console.log('[services] Filas leídas:', raw.length);
    console.log('[services] Encabezados detectados:', raw[0] ? Object.keys(raw[0]) : '(ninguno)');
    console.log('[services] Primera fila (JSON):', raw[0] ? JSON.stringify(raw[0]).slice(0, 600) : '(vacío)');

    _services = raw
      .map(mapService)
      .filter(s => s.id && s.name);

    // Marcar disponibilidad
    _services.forEach(s => {
      s.available = !UNAVAILABLE_STATES.includes(normKey(s.active));
    });

    console.log('[services] Servicios normalizados:', _services.length);
    if (_services[0]) console.log('[services] Primer servicio normalizado:', _services[0]);

    if (_services.length === 0) {
      statusEl.textContent = 'No hay servicios disponibles por ahora.';
      return;
    }

    statusEl.hidden = true;
    renderFilters(filtersEl);
    renderGrid(gridEl);

  } catch (err) {
    console.error('[services] Error cargando CSV:', err);
    statusEl.textContent = 'No se pudieron cargar los servicios. Intenta de nuevo más tarde.';
    statusEl.classList.add('is-error');
  }
}

/** Normaliza una fila CSV a un objeto interno usando pick() flexible. */
function mapService(row) {
  const c = CONFIG.CSV_COLS;

  const priceStr = pick(row, c.price);
  const priceNum = parsePrice(priceStr);

  return {
    id:       pick(row, c.id),
    name:     pick(row, c.name),
    image:    pick(row, c.image),
    desc:     pick(row, c.desc),
    category: pick(row, c.category) || 'General',
    duration: pick(row, c.duration),
    price:    priceStr,
    priceNumber: Number.isFinite(priceNum) ? priceNum : 0,
    active:   pick(row, c.active) || 'Disponible',
    available: true // se recalcula después
  };
}

/** Renderiza los chips de filtros por categoría. */
function renderFilters(container) {
  const cats = ['__all__', ...Array.from(new Set(_services.map(s => s.category).filter(Boolean)))];
  container.innerHTML = cats.map(cat => {
    const label = cat === '__all__' ? 'Todos' : cat;
    const selected = cat === _activeCategory ? 'true' : 'false';
    return `<button class="chip" role="tab" aria-selected="${selected}" data-cat="${escapeHTML(cat)}">${escapeHTML(label)}</button>`;
  }).join('');

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    _activeCategory = btn.dataset.cat;
    container.querySelectorAll('.chip').forEach(c =>
      c.setAttribute('aria-selected', c === btn ? 'true' : 'false'));
    renderGrid(document.getElementById('services-grid'));
  });
}

/** Renderiza el grid filtrado por la categoría activa. */
function renderGrid(container) {
  const list = _activeCategory === '__all__'
    ? _services
    : _services.filter(s => s.category === _activeCategory);

  if (list.length === 0) {
    container.innerHTML = `<p class="status">Sin servicios en esta categoría.</p>`;
    return;
  }

  container.innerHTML = list.map(s => `
    <article class="service glass ${s.available ? '' : 'service--unavailable'}" role="listitem" data-id="${escapeHTML(s.id)}">
      <div class="service__media">
        ${s.image
          ? `<img src="${escapeHTML(s.image)}" alt="${escapeHTML(s.name)}" loading="lazy" decoding="async" width="400" height="300"
                  onerror="this.style.display='none'">`
          : `<div aria-hidden="true"></div>`}
      </div>
      <div class="service__body">
        <span class="service__cat">
          ${escapeHTML(s.category)}
          ${s.available ? '' : '<span class="service__badge">No disponible</span>'}
        </span>
        <h3 class="service__name">${escapeHTML(s.name)}</h3>
        <p class="service__desc">${escapeHTML(s.desc)}</p>
        <div class="service__foot">
          <div>
            <div class="service__price">${escapeHTML(formatPrice(s.price))}</div>
            ${s.duration ? `<div class="service__dur">⏱ ${escapeHTML(s.duration)}</div>` : ''}
          </div>
          ${s.available
            ? `<button class="btn btn-primary" data-add="${escapeHTML(s.id)}"
                       aria-label="Agregar ${escapeHTML(s.name)} al carrito">Agregar</button>`
            : `<button class="btn btn-ghost" disabled
                       aria-label="${escapeHTML(s.name)} no disponible">No disponible</button>`}
        </div>
      </div>
    </article>
  `).join('');

  container.querySelectorAll('[data-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-add');
      const svc = _services.find(s => s.id === id);
      if (svc) addToCart(svc);
    });
  });
}

/** Devuelve el servicio por id. */
export function getServiceById(id) {
  return _services.find(s => s.id === id);
}