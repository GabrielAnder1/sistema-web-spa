// =========================================================
// Página /agendar.html
// - Resumen con tiempo estimado (suma de duraciones).
// - Envío a Apps Script (createBooking).
// - Modal de éxito / error.
// =========================================================

import { CONFIG } from './config.js';
import { getItems, getTotal, clearCart } from './cart.js';
import { formatPrice, escapeHTML } from './utils.js';

const form      = document.getElementById('booking-form');
const summaryEl = document.getElementById('booking-summary-list');
const totalEl   = document.getElementById('booking-total');
const durEl     = document.getElementById('booking-duration');
const emptyEl   = document.getElementById('booking-empty');
const btnSubmit = document.getElementById('btn-submit');
const yearEl    = document.getElementById('year');

// Modal
const modal     = document.getElementById('modal');
const modalTitle= document.getElementById('modal-title');
const modalMsg  = document.getElementById('modal-msg');
const modalIcon = document.getElementById('modal-icon');
const modalRef  = document.getElementById('modal-ref');

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const fechaInput = document.getElementById('fecha');
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  fechaInput.min = iso;
  fechaInput.value = iso;

  renderSummary();
  form?.addEventListener('submit', onSubmit);

  // Modal: cerrar
  modal.addEventListener('click', (e) => {
    if (e.target.matches('[data-close]')) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  if (getItems().length === 0) {
    emptyEl.hidden = false;
    btnSubmit.disabled = true;
  }
});

/* ---------- Resumen con duración total ---------- */
function renderSummary() {
  const items = getItems();

  if (items.length === 0) {
    summaryEl.innerHTML = `<li class="booking-summary__empty">Sin servicios seleccionados.</li>`;
    durEl.textContent = '—';
  } else {
    summaryEl.innerHTML = items.map(it => `
      <li class="booking-summary__item">
        <span>${escapeHTML(it.name)}</span>
        <span>${escapeHTML(it.priceLabel || formatPrice(it.price))}</span>
      </li>
    `).join('');
    durEl.textContent = formatDuration(estimateDuration(items));
  }
  totalEl.textContent = formatPrice(getTotal());
}

/** Suma minutos de duración de los items. */
function estimateDuration(items) {
  let total = 0;
  items.forEach(it => { total += parseDuration(it.duration); });
  return total;
}

/** "30min" → 30 · "1h" → 60 · "1h 30min" → 90 · "" → 0 */
function parseDuration(str) {
  const s = String(str || '').toLowerCase().trim();
  if (!s) return 0;
  let mins = 0;
  const h = s.match(/(\d+)\s*h/);
  const m = s.match(/(\d+)\s*min/);
  if (h) mins += Number(h[1]) * 60;
  if (m) mins += Number(m[1]);
  if (!h && !m) {
    const n = s.match(/(\d+)/);
    if (n) mins = Number(n[1]);
  }
  return mins;
}

/** "50 min" · "1 h 20 min" */
function formatDuration(min) {
  if (!min || min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}

/* ---------- Envío ---------- */
async function onSubmit(e) {
  e.preventDefault();

  if (!form.checkValidity()) { form.reportValidity(); return; }
  const items = getItems();
  if (items.length === 0) { openModal('error', 'Carrito vacío', 'Agrega al menos un servicio antes de agendar.'); return; }

  const payload = {
    action: 'createBooking',
    nombre:   form.nombre.value.trim(),
    telefono: form.telefono.value.trim(),
    email:    form.email.value.trim(),
    fecha:    form.fecha.value,
    hora:     form.hora.value,
    notas:    form.notas.value.trim(),
    servicios: items.map(i => ({
      id: i.id, name: i.name, price: i.price,
      priceLabel: i.priceLabel || formatPrice(i.price),
      duration: i.duration || ''
    })),
    total: getTotal(),
    duracion: estimateDuration(items)
  };

  btnSubmit.setAttribute('aria-busy', 'true');
  btnSubmit.textContent = 'Enviando…';

  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
      redirect: 'follow'
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Error desconocido');

    // Éxito
    clearCart();
    form.reset();
    renderSummary();
    btnSubmit.disabled = true;
    openModal('ok',
      '¡Gracias por tu solicitud!',
      'Te estaremos avisando por WhatsApp. En caso de no recibir un mensaje de confirmación en 24 horas, por favor escríbenos y te atenderemos con gusto.',
      data.id
    );
  } catch (err) {
    console.error('[booking] Error:', err);
    openModal('error',
      'No pudimos enviar tu solicitud',
      'Tu solicitud no se ha podido enviar por un error. Por favor intenta nuevamente o escríbenos por WhatsApp.'
    );
  } finally {
    btnSubmit.removeAttribute('aria-busy');
    btnSubmit.textContent = 'Enviar solicitud';
  }
}

/* ---------- Modal ---------- */
function openModal(kind, title, msg, ref) {
  modal.hidden = false;
  modal.classList.toggle('modal--ok', kind === 'ok');
  modal.classList.toggle('modal--error', kind === 'error');
  modalIcon.textContent = kind === 'ok' ? '✦' : '⚠';
  modalTitle.textContent = title;
  modalMsg.textContent = msg;

  if (ref) {
    modalRef.hidden = false;
    modalRef.querySelector('code').textContent = ref;
  } else {
    modalRef.hidden = true;
  }
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = '';
}