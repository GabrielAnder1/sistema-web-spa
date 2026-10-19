const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzS7li_kz2OX1gZ7WRGoiPLoIbiRA44WQaZfN1DSpQcpsdL0ODBUgkpEWXJY8f6_SM/exec';
const LS_TOKEN = 'odspa_admin_token_v1';

let _token = localStorage.getItem(LS_TOKEN) || '';
let _status = 'Pendiente';
let _sortField = 'Fecha Registro';
let _sortDir = 'desc';
let _query = '';
let _page = 1;
let _totalPages = 1;
let _searchTimer;

let _cacheCitas = null;
let _cacheServicios = null;
let _selectedCalendarDate = new Date();
let toastTimer;

const $ = id => document.getElementById(id);

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  $('login-form').addEventListener('submit', onLogin);
  $('btn-logout').addEventListener('click', onLogout);
  $('btn-reload').addEventListener('click', () => { _cacheCitas = null; loadBookings(true); });
  $('btn-export').addEventListener('click', exportExcel);

  $('filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip'); if (!btn) return;
    _status = btn.dataset.status; _page = 1;
    $('filters').querySelectorAll('.chip').forEach(c => c.setAttribute('aria-selected', c === btn ? 'true' : 'false'));
    loadBookings(false);
  });

  $('sort-field').value = _sortField;
  $('sort-field').addEventListener('change', (e) => { _sortField = e.target.value; _page = 1; loadBookings(false); });
  $('sort-dir').addEventListener('click', () => {
    _sortDir = _sortDir === 'asc' ? 'desc' : 'asc'; $('sort-dir').textContent = _sortDir === 'asc' ? '↑' : '↓'; loadBookings(false);
  });

  $('search').addEventListener('input', (e) => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => { _query = e.target.value.trim(); _page = 1; loadBookings(false); }, 300);
  });

  $('pg-prev').addEventListener('click', () => { if (_page > 1) { _page--; loadBookings(false); } });
  $('pg-next').addEventListener('click', () => { if (_page < _totalPages) { _page++; loadBookings(false); } });

  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchView(t.dataset.view)));
  $('m-apply').addEventListener('click', loadMetrics);
  $('btn-add-service').addEventListener('click', () => renderServiceRow({}));

  if (_token) trySilentLogin(); else showLogin();
});

/* ---------- Auth ---------- */
async function onLogin(e) {
  e.preventDefault();
  const tk = $('token').value.trim();
  $('btn-login').disabled = true; $('btn-login').textContent = '...';
  try {
    await api({ action: 'adminCheck', token: tk });
    _token = tk; localStorage.setItem(LS_TOKEN, tk); enterDashboard();
  } catch (e) {
    $('login-msg').hidden = false;
    $('login-msg').textContent = (e.message === 'No autorizado' || e.message === 'Acción desconocida') ? 'Token incorrecto.' : 'Error de conexión.';
  }
  finally { $('btn-login').disabled = false; $('btn-login').textContent = 'Entrar'; }
}
async function trySilentLogin() {
  try { await api({ action: 'adminCheck', token: _token }); enterDashboard(); }
  catch { localStorage.removeItem(LS_TOKEN); showLogin(); }
}
function onLogout() { localStorage.removeItem(LS_TOKEN); _token = ''; showLogin(); }
function showLogin() { $('login-view').hidden = false; $('dash-view').hidden = true; $('btn-logout').hidden = true; }
function enterDashboard() { $('login-view').hidden = true; $('dash-view').hidden = false; $('btn-logout').hidden = false; loadBookings(false); }

/* ---------- Vistas ---------- */
function switchView(v) {
  document.querySelectorAll('.view').forEach(el => el.hidden = (el.id !== 'view-' + v));
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', t.dataset.view === v ? 'true' : 'false'));
  if (v === 'calendar') loadCalendar();
  if (v === 'metrics') loadMetrics();
  if (v === 'services') loadServicesAdmin();
}

/* ---------- Lista de Citas ---------- */
async function loadBookings(showToast) {
  $('dash-status').hidden = false; $('bookings').innerHTML = `<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>`;

  try {
    let list = [];
    if (_cacheCitas && !_query && _status === 'all' && _page === 1) {
      list = _cacheCitas;
    } else {
      const res = await api({ action: 'listBookings', token: _token, status: _status, sortField: _sortField, sortDir: _sortDir, page: _page, limit: 20, query: _query });
      list = res.bookings || []; _totalPages = res.totalPages || 1;
      if(!_query && _status === 'all' && _page === 1) _cacheCitas = list;
    }

    $('dash-status').hidden = true;
    if (list.length === 0) {
      $('bookings').innerHTML = `<div class="empty-state"><div class="empty-state__icon">📭</div><p>No hay citas en este estado.</p></div>`;
      $('pagination').hidden = true; return;
    }
    renderBookings(list);
    $('pagination').hidden = (_totalPages <= 1);
    $('pg-info').textContent = `Pág ${_page} de ${_totalPages}`;
    if (showToast) toast('Actualizado');
  } catch (e) { $('dash-status').hidden = true; toast(e.message, true); }
}

function renderBookings(list) {
  $('bookings').innerHTML = list.map(b => {
    const st = b['Estado'].toLowerCase();
    const canAct = st === 'pendiente';
    const canComp = st === 'aprobada';
    return `
      <article class="booking-card glass">
        <div class="booking-card__head">
          <div><h3 style="margin:0;font-family:var(--font-head)">${esc(b['Nombre'])}</h3><span style="font-size:12px;color:#888">${esc(b['ID'])}</span></div>
          <span class="estado estado--${st}">${b['Estado']}</span>
        </div>
        <div class="booking-card__grid">
          <div><b>Fecha</b> ${b['Fecha Cita']} · ${b['Hora Cita']} - ${b['Hora Fin'] || '?'}</div>
          <div><b>Teléfono</b> ${esc(b['Teléfono'])}</div>
          <div><b>Total</b> $${b['Total']}</div>
          <div><b>Email</b> ${esc(b['Email']||'-')}</div>
        </div>
        <div class="booking-card__services">${esc(b['Servicios'])}</div>
        <div class="booking-card__actions">
          ${canAct ? `<button class="btn btn-approve" data-action="approve" data-id="${b['ID']}">✓ Aprobar</button>
                      <button class="btn btn-reject" data-action="reject" data-id="${b['ID']}">✕ Rechazar</button>` : ''}
          ${canComp ? `<button class="btn btn-complete" data-action="complete" data-id="${b['ID']}">✓ Finalizar</button>` : ''}
          ${b._waLink ? `<a class="btn btn-wa" href="${b._waLink}" target="_blank">WhatsApp</a>` : ''}
        </div>
      </article>`;
  }).join('');

  $('bookings').querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => onAction(btn.dataset.action, btn.dataset.id, btn));
  });
}

async function onAction(act, id, btn) {
  if (!confirm(`¿Confirmar acción ${act}?`)) return;
  btn.disabled = true; btn.textContent = '...';
  try {
    const res = await api({ token: _token, id, action: act + 'Booking', force: false });
    if (res.conflict) {
      const ok = confirm(`⚠️ Solapamiento con ${res.conflicts[0].nombre}.\n¿Aprobar igual?`);
      if (ok) { await api({ token: _token, id, action: 'approveBooking', force: true }); toast('Aprobada'); }
    } else { toast('Acción realizada'); }
    _cacheCitas = null; loadBookings(false);
  } catch (e) { toast(e.message, true); btn.disabled = false; }
}

/* ---------- Calendario ---------- */
async function loadCalendar() {
  const el = $('calendar-dashboard');
  el.hidden = true; $('view-calendar').insertAdjacentHTML('beforeend', '<p class="status" id="cal-load">Cargando...</p>');
  
  try {
    const res = await api({ action: 'listBookings', token: _token, status: 'all', limit: 1000 });
    document.getElementById('cal-load')?.remove();
    renderCalendarBase(res.bookings || []);
    el.hidden = false;
  } catch (e) { toast(e.message, true); }
}

function renderCalendarBase(all) {
  // 1. Próximas
  const today = new Date(); today.setHours(0,0,0,0);
  const upcoming = all.filter(b => new Date(b['Fecha Cita']+'T00:00:00') >= today && b['Estado']!=='Rechazada')
                      .sort((a,b)=> (a['Fecha Cita']+a['Hora Cita']).localeCompare(b['Fecha Cita']+b['Hora Cita'])).slice(0,10);
  $('cal-upcoming').innerHTML = upcoming.length ? upcoming.map(b => `
    <div class="cal-mini-card" onclick="jumpToList('${b['ID']}')">
      <div style="font-size:11px;color:#aaa;margin-bottom:4px;">${b['Fecha Cita']} · ${b['Hora Cita']}</div>
      <div style="font-weight:600">${esc(b['Nombre'])}</div>
    </div>`).join('') : `<div class="empty-state">Sin citas próximas</div>`;

  // 2. Mes
  const y = _selectedCalendarDate.getFullYear(), m = _selectedCalendarDate.getMonth();
  const daysInM = new Date(y, m+1, 0).getDate(); let startDow = new Date(y, m, 1).getDay() || 7;
  let mHtml = ['L','M','X','J','V','S','D'].map(d=>`<div style="font-size:10px;text-align:center;color:#888;padding-bottom:8px;">${d}</div>`).join('');
  for(let i=1;i<startDow;i++) mHtml += `<div></div>`;
  for(let d=1;d<=daysInM;d++){
    const iso = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const has = all.some(b => b['Fecha Cita']===iso && b['Estado']!=='Rechazada');
    const sel = iso === toISODate(_selectedCalendarDate) ? 'is-selected' : '';
    mHtml += `<div class="cal-month-day ${has?'has-events':''} ${sel}" onclick="selectCalDay('${iso}')">${d}</div>`;
  }
  $('cal-month').innerHTML = mHtml;

  // 3. Día
  const selectedIso = toISODate(_selectedCalendarDate);
  const dayBooks = all.filter(b=>b['Fecha Cita']===selectedIso && b['Estado']!=='Rechazada').sort((a,b)=>a['Hora Cita'].localeCompare(b['Hora Cita']));
  $('cal-selected-title').textContent = selectedIso === toISODate(new Date()) ? 'Hoy' : selectedIso;
  $('cal-today').innerHTML = dayBooks.length ? dayBooks.map(b=>`
    <div class="cal-today-item">
      <div><b>${b['Hora Cita']} - ${b['Hora Fin']||'?'}</b> · ${esc(b['Nombre'])}</div>
      <span class="estado estado--${b['Estado'].toLowerCase()}" style="font-size:10px;padding:2px 6px;">${b['Estado']}</span>
    </div>`).join('') : `<div class="empty-state">No hay citas este día</div>`;

  // 4. Semana
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  let wHtml = '';
  for(let i=0;i<7;i++){
    const d = new Date(tomorrow); d.setDate(d.getDate()+i);
    const iso = toISODate(d);
    const evs = all.filter(b=>b['Fecha Cita']===iso && b['Estado']!=='Rechazada').sort((a,b)=>a['Hora Cita'].localeCompare(b['Hora Cita']));
    wHtml += `<div class="cal-week-col">
      <div class="cal-week-head">${d.getDate()} ${monthShort(d)}</div>
      <div class="cal-week-body">
        ${evs.map(b=>`<div class="cal-week-event cal-week-event--${b['Estado'].toLowerCase()}" onclick="jumpToList('${b['ID']}')"><b>${b['Hora Cita']}</b> ${esc(b['Nombre'])}</div>`).join('')}
      </div>
    </div>`;
  }
  $('cal-week').innerHTML = wHtml;
}

window.selectCalDay = (iso) => {
  _selectedCalendarDate = new Date(iso+'T12:00:00');
  const el = $('calendar-dashboard');
  if(!el.hidden) {
    api({ action: 'listBookings', token: _token, status: 'all', limit: 1000 }).then(r => renderCalendarBase(r.bookings||[]));
  }
};
window.jumpToList = (id) => {
  switchView('list'); $('search').value = id; _query = id; _status = 'all';
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-selected', c.dataset.status === 'all' ? 'true':'false'));
  loadBookings(false);
};

/* ---------- Métricas ---------- */
async function loadMetrics() {
  const el = $('metrics'); el.hidden = true;
  const desde = $('m-desde').value || toISODate(new Date(Date.now() - 90*86400000));
  const hasta = $('m-hasta').value || toISODate(new Date());
  $('m-desde').value = desde; $('m-hasta').value = hasta;

  try {
    const res = await api({ action: 'getStats', token: _token, desde, hasta });
    
    // Tarjetas
    const cards = [
      { cls: 'metric-card--money', label: 'Ingresos est.', value: '$' + Number(res.ingresosEstimados||0).toFixed(2) },
      { cls: 'metric-card--pending', label: 'Pendientes', value: res.porEstado.pendientes },
      { cls: 'metric-card--approved', label: 'Aprobadas', value: res.porEstado.aprobadas },
      { cls: 'metric-card--completed', label: 'Completadas', value: res.porEstado.completadas }
    ];
    $('metric-cards').innerHTML = cards.map(c => `
      <div class="metric-card ${c.cls}"><span class="metric-card__label">${c.label}</span><span class="metric-card__value">${c.value}</span></div>
    `).join('');

    // Semanas
    const weeks = res.citasPorSemana || []; const maxW = Math.max(1, ...weeks.map(w=>w.count));
    $('metric-weeks').innerHTML = weeks.length ? weeks.map(w => `
      <div class="bar-row"><span class="bar-row__label">${w.semana}</span><span class="bar-row__value">${w.count}</span><div class="bar-row__bar"><span style="width:${(w.count/maxW)*100}%"></span></div></div>
    `).join('') : `<p style="font-size:13px;color:#888">Sin datos.</p>`;

    // Servicios
    const svcs = res.topServicios || []; const maxS = Math.max(1, ...svcs.map(s=>s.count));
    $('metric-services').innerHTML = svcs.length ? svcs.map(s => `
      <div class="bar-row"><span class="bar-row__label">${esc(s.nombre)}</span><span class="bar-row__value">${s.count}</span><div class="bar-row__bar"><span style="width:${(s.count/maxS)*100}%"></span></div></div>
    `).join('') : `<p style="font-size:13px;color:#888">Sin datos.</p>`;

    el.hidden = false;
  } catch (e) { toast(e.message, true); }
}

/* ---------- Servicios ---------- */
async function loadServicesAdmin() {
  const el = $('services-list');
  el.innerHTML = `<div class="skeleton skeleton-card"></div>`;
  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=services&_=${Date.now()}`);
    const d = await res.json();
    if(!d.ok) throw new Error('Error al cargar');
    el.innerHTML = '';
    d.services.forEach(svc => renderServiceRow(svc));
    _cacheServicios = d.services;
  } catch(e) { el.innerHTML = `<div class="empty-state">Error al cargar servicios</div>`; }
}

function renderServiceRow(svc) {
  const el = $('services-list');
  const row = document.createElement('div'); row.className = 'service-edit-row';
  const isNew = !svc['Código'];
  const code = svc['Código'] || '';

  row.innerHTML = `
    <input type="text" value="${esc(code)}" placeholder="ID" readonly>
    <input type="text" value="${esc(svc['Nombre del Servicio']||'')}" placeholder="Nombre" data-f="Nombre del Servicio">
    <input type="text" value="${esc(svc['Categoría']||'')}" placeholder="Categoría" data-f="Categoría">
    <input type="text" value="${esc(svc['Duración Estimada']||'')}" placeholder="Ej. 30min" data-f="Duración Estimada">
    <input type="text" value="${esc(svc['Precio del Servicio']||'')}" placeholder="Precio" data-f="Precio del Servicio">
    <select data-f="Estado del Servicio">
      <option value="Disponible" ${svc['Estado del Servicio']!=='No Disponible'?'selected':''}>Disponible</option>
      <option value="No Disponible" ${svc['Estado del Servicio']==='No Disponible'?'selected':''}>No Disponible</option>
    </select>
    <div class="service-edit-row__actions">
      ${!isNew ? `<button class="btn-icon-sm" onclick="moveSvc('${code}','up')" title="Subir">↑</button><button class="btn-icon-sm" onclick="moveSvc('${code}','down')" title="Bajar">↓</button>` : ''}
      <button class="btn-icon-sm" onclick="saveSvc(this)" title="Guardar">💾</button>
      ${!isNew ? `<button class="btn-icon-sm is-danger" onclick="delSvc('${code}')" title="Eliminar">✕</button>` : ''}
    </div>
    <div class="service-edit-row__desc">
      <input type="url" value="${esc(svc['Url de Imagen']||'')}" placeholder="URL Imagen" data-f="Url de Imagen" style="flex:1">
      <input type="text" value="${esc(svc['Descripción del Servicio']||'')}" placeholder="Descripción" data-f="Descripción del Servicio" style="flex:2">
    </div>
  `;
  if(isNew) el.prepend(row); else el.appendChild(row);
}

window.saveSvc = async (btn) => {
  const row = btn.closest('.service-edit-row');
  const data = { action:'saveService', token:_token };
  row.querySelectorAll('[data-f]').forEach(i => data[i.dataset.f] = i.value);
  if(!row.querySelector('[data-f="Nombre del Servicio"]').value) return toast('Nombre requerido', true);
  if(!row.querySelector('input[readonly]').value) data['Código'] = 'OD-'+Date.now().toString().slice(-4);
  else data['Código'] = row.querySelector('input[readonly]').value;
  
  btn.disabled = true; btn.textContent = '...';
  try { await api(data); toast('Guardado'); loadServicesAdmin(); } catch(e) { toast(e.message, true); btn.disabled=false; btn.textContent='💾'; }
};
window.delSvc = async (code) => {
  if(!confirm('¿Eliminar servicio?')) return;
  try { await api({ action:'deleteService', token:_token, codigo:code }); loadServicesAdmin(); } catch(e) { toast(e.message, true); }
};
window.moveSvc = async (code, dir) => {
  try { await api({ action:'moveService', token:_token, codigo:code, direction:dir }); loadServicesAdmin(); } catch(e) { toast(e.message, true); }
};

/* ---------- Exportar Excel ---------- */
async function exportExcel() {
  try {
    const res = await api({ action: 'listBookings', token: _token, status: _status, sortField: _sortField, sortDir: _sortDir, page: 1, limit: 10000, query: _query });
    const list = res.bookings || [];
    if (list.length === 0) return toast('No hay datos', true);

    const cols = ['ID','Fecha Registro','Nombre','Teléfono','Email','Servicios','Total','Fecha Cita','Hora Cita','Hora Fin','Estado','Notas'];
    let html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table border="1">`;
    html += `<tr style="background:#000;color:#fff">` + cols.map(c=>`<th>${c}</th>`).join('') + `</tr>`;
    list.forEach(b => { html += `<tr>` + cols.map(c => `<td>${esc(b[c]||'').replace(/\n/g,' | ')}</td>`).join('') + `</tr>`; });
    html += `</table></body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `odspa-citas.xls`;
    document.body.appendChild(a); a.click(); a.remove();
    toast('Excel exportado');
  } catch (err) { toast('Error al exportar', true); }
}

/* ---------- Global Utils ---------- */
async function api(payload) {
  const res = await fetch(APPS_SCRIPT_URL, { method:'POST', body:JSON.stringify(payload) });
  const d = await res.json(); if(!d.ok && !d.conflict) throw new Error(d.error); return d;
}
function esc(s) { return String(s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function toISODate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function monthShort(d) { return ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][d.getMonth()]; }
function toast(msg, isErr=false) {
  const el = $('toast'); el.textContent = msg; el.hidden = false;
  el.className = isErr ? 'admin-toast is-error' : 'admin-toast';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, 3000);
}