// =========================================================
// Entrada principal: UI (header, menú lateral, drawer carrito)
// y arranque de los módulos del catálogo.
// =========================================================

import { loadServices } from './services.js';
import { initCart } from './cart.js';

/* ---------- UI: menú lateral y overlay ---------- */
function initUI() {
  const sideNav = document.getElementById('side-nav');
  const cartDrawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('overlay');
  const btnMenu = document.getElementById('btn-menu');
  const btnMenuClose = document.getElementById('btn-menu-close');
  const btnCart = document.getElementById('btn-cart');
  const btnCartClose = document.getElementById('btn-cart-close');

  function open(el, button) {
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    button?.setAttribute('aria-expanded', 'true');
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeAll() {
    [sideNav, cartDrawer].forEach(el => {
      el.classList.remove('is-open');
      el.setAttribute('aria-hidden', 'true');
    });
    btnMenu?.setAttribute('aria-expanded', 'false');
    btnCart?.setAttribute('aria-expanded', 'false');
    overlay.hidden = true;
    document.body.style.overflow = '';
  }

  btnMenu?.addEventListener('click', () => open(sideNav, btnMenu));
  btnCart?.addEventListener('click', () => open(cartDrawer, btnCart));
  btnMenuClose?.addEventListener('click', closeAll);
  btnCartClose?.addEventListener('click', closeAll);
  overlay?.addEventListener('click', closeAll);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });

  // Cerrar al clickear un link del side nav
  sideNav?.querySelectorAll('a').forEach(a => a.addEventListener('click', closeAll));

  // Año del footer
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
}

/* ---------- Arranque ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initUI();
  initCart();
  // Solo carga el catálogo si la página tiene la sección de servicios
  if (document.getElementById('services-grid')) loadServices();

  // Fecha del documento legal (si aplica)
  const legalDate = document.getElementById('legal-date');
  if (legalDate) {
    const d = new Date();
    const meses = ['enero','febrero','marzo','abril','mayo','junio',
                   'julio','agosto','septiembre','octubre','noviembre','diciembre'];
    legalDate.textContent = `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
    legalDate.setAttribute('datetime', d.toISOString().slice(0,10));
  }
});