// =========================================================
// Carrito: estado en localStorage, render y sincronización UI.
// =========================================================

import { CONFIG } from './config.js';
import { formatPrice, escapeHTML } from './utils.js';

/** @type {{items: Array<{id:string,name:string,price:number,priceLabel:string,duration:string,image:string,category:string}>}} */
let state = load();

/* ---------- Persistencia ---------- */
function load() {
  try {
    const raw = localStorage.getItem(CONFIG.LS_CART);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw);
    return parsed && Array.isArray(parsed.items) ? parsed : { items: [] };
  } catch { return { items: [] }; }
}
function save() {
  try { localStorage.setItem(CONFIG.LS_CART, JSON.stringify(state)); } catch {}
}

/* ---------- API pública ---------- */
export function getItems() { return [...state.items]; }
export function getTotal() {
  return state.items.reduce((acc, it) => acc + (Number(it.price) || 0), 0);
}
export function addToCart(service) {
  const exists = state.items.find(i => i.id === service.id);
  if (exists) { flash(`"${service.name}" ya está en el carrito`); return; }
  state.items.push({
    id: service.id,
    name: service.name,
    price: Number(service.priceNumber) || 0,
    priceLabel: service.price,
    duration: service.duration || '',
    image: service.image || '',
    category: service.category || ''
  });
  save();
  render();
  flash(`"${service.name}" agregado`);
}
export function removeFromCart(id) {
  state.items = state.items.filter(i => i.id !== id);
  save();
  render();
}
export function clearCart() {
  state.items = [];
  save();
  render();
}

/* ---------- Render ---------- */
function render() {
  const listEl = document.getElementById('cart-list');
  const totalEl = document.getElementById('cart-total');
  const countEl = document.getElementById('cart-count');

  if (countEl) {
    countEl.textContent = state.items.length;
    countEl.classList.toggle('is-visible', state.items.length > 0);
  }

  if (!listEl) return;

  if (state.items.length === 0) {
    listEl.innerHTML = `<li class="cart-list__empty">Tu carrito está vacío.</li>`;
  } else {
    listEl.innerHTML = state.items.map(it => `
      <li class="cart-item">
        ${it.image
          ? `<img class="cart-item__img" src="${escapeHTML(it.image)}" alt="" loading="lazy" decoding="async">`
          : `<div class="cart-item__img" aria-hidden="true"></div>`}
        <div class="cart-item__body">
          <h3 class="cart-item__name">${escapeHTML(it.name)}</h3>
          <div class="cart-item__meta">${escapeHTML(it.category)}${it.duration ? ' · ' + escapeHTML(it.duration) : ''}</div>
          <div class="cart-item__price">${escapeHTML(it.priceLabel)}</div>
        </div>
        <button class="cart-item__remove" data-remove="${escapeHTML(it.id)}" aria-label="Quitar ${escapeHTML(it.name)}">Quitar</button>
      </li>
    `).join('');
    listEl.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => removeFromCart(btn.getAttribute('data-remove')));
    });
  }

  if (totalEl) totalEl.textContent = formatPrice(getTotal());
}

/* ---------- Feedback visual breve ---------- */
let flashTimer;
function flash(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    Object.assign(el.style, {
      position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
      padding: '10px 16px', borderRadius: '999px',
      background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)',
      backdropFilter: 'blur(10px)', color: '#fff', fontSize: '13px', zIndex: 100,
      transition: 'opacity .25s ease'
    });
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { el.style.opacity = '0'; }, 1800);
}

/* ---------- Init ---------- */
export function initCart() { render(); }