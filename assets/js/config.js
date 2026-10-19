// =========================================================
// Configuración central. Edita solo este archivo para
// cambiar URLs, moneda o claves de almacenamiento.
// =========================================================

export const CONFIG = {
  // CSV público de servicios (solo lectura)
  SERVICES_CSV: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTl3fwBD76Ok9f5Nntg0qlgzfssCoyCWtHOKq24xqDJ3Xnitmo5SUq0sDYHrrLbzAU3VYoF3veYDC4M/pub?gid=1933496640&single=true&output=csv',

  // URL del Web App de Apps Script (Fase 2). Placeholder por ahora.
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzS7li_kz2OX1gZ7WRGoiPLoIbiRA44WQaZfN1DSpQcpsdL0ODBUgkpEWXJY8f6_SM/exec',

  CURRENCY: 'USD',
  LOCALE: 'es-VE',

  // Claves de almacenamiento local
  LS_CART: 'odspa_cart_v1',

  // Nombres exactos de columnas del CSV de servicios
  CSV_COLS: {
    id: 'Código',
    name: 'Nombre del Servicio',
    image: 'Url de Imagen',
    desc: 'Descripción del Servicio',
    category: 'Categoría',
    duration: 'Duración Estimada',
    price: 'Precio del Servicio',
    active: 'Estado del Servicio'
  }
};