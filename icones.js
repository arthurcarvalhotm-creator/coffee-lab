/* =====================================================================
 * Laboratório de Cafeteria — ícones de traço dos métodos de preparo
 * Traço na cor do texto + detalhe na cor de destaque (--ico-acc).
 * Preenche o campo "icone" de cada método do banco nativo.
 * ===================================================================== */
window.IconesMetodo = (function () {
  'use strict';
  const A = 'class="acc"', AF = 'class="acc fill"'; // detalhe em destaque (traço / preenchido)
  const D = {
    espresso: `<path d="M11 19h21v8a9 9 0 0 1-9 9h-3a9 9 0 0 1-9-9z"/><path d="M32 22h3a4.5 4.5 0 0 1 0 9h-3.6"/><path d="M7 40h30"/><path ${A} d="M13.5 23.5h16"/><path ${A} d="M18 7c-2 2.6 2 4.4 0 7.5M25 7c-2 2.6 2 4.4 0 7.5"/>`,
    moka: `<path d="M13 9h20l-3.5 15h-13z"/><path d="M16.5 26h13l4.5 15h-22z"/><path d="M33 11.5h4.5l-2.5 10h-3.5"/><path d="M13 9l-3.5-2"/><path ${A} d="M16 24.8h14"/><path ${A} d="M21 9V6.2h4V9"/>`,
    v60: `<path d="M8 12h30l-11.5 18h-7z"/><path d="M38 14c5.5 0 5.5 8.5-2.5 9.5"/><path d="M11 35h24"/><path d="M19.5 30v5M26.5 30v5"/><path ${A} d="M16 15.5c1.2 4.2 3.6 8 6 11.5M24 15.5c.4 3.6 1.2 7 2.4 10.2M31 15.5c-.8 3-2 5.8-3.2 8.3"/>`,
    origami: `<path d="M8 13l2.7-2.5 2.7 2.5 2.7-2.5 2.7 2.5 2.6-2.5 2.6 2.5 2.6-2.5 2.6 2.5 2.7-2.5 2.7 2.5 2.7-2.5 2.7 2.5"/><path d="M8 13l12 18h8l12-18"/><path d="M14 31h20"/><path d="M11 35h26"/><path d="M18.5 31v4M29.5 31v4"/><path ${A} stroke-width="1.8" d="M13.4 13l7.8 18M18.8 13l4.2 18M24 10.5V31M29.2 13l-4.2 18M34.6 13l-7.8 18"/>`,
    suiren: `<path d="M9 12c2.5 6.5 6.5 12.5 10.5 17.5M39 12c-2.5 6.5-6.5 12.5-10.5 17.5"/><path d="M9 12l2.5-2 2 2.5M15.5 11.5l2-2 2 2.2M22 11l2-2 2 2M28.5 11.7l2-2.2 2 2M34.5 12.5l2-2.5 2.5 2"/><path d="M17.5 29.5h13l-1 3.5h-11z"/><path d="M30.5 30c5 0 5.5 5-1 6"/><path d="M11 37h26"/><path d="M19.5 33v4M28.5 33v4"/><path ${A} stroke-width="2" d="M14.5 12c1.8 6 4.8 12 7.5 17.5M20 11.5c1.2 6 2.8 12 4.2 18M26 11.5c-.4 6-1 12-1 18M32.5 12c-1.8 6-4 12-5.8 17.5"/>`,
    kalita: `<path d="M8 12h30l-6.5 19h-17z"/><path d="M11 36h24"/><path d="M17 31v5M29 31v5"/><path d="M38 14c5 0 5 8-2 9"/><path ${A} d="M10 12.5l2.4 3 2.4-3 2.4 3 2.4-3 2.4 3 2.4-3 2.4 3 2.4-3 2.4 3 2.4-3 2.4 3 2.4-3"/><path ${A} d="M18.5 19.5l1.8 9M23 19.5v9M27.5 19.5l-1.8 9"/>`,
    b75: `<path d="M8 12h30l-6 18h-18z"/><path d="M11 35h24"/><path d="M16.5 30v5M29.5 30v5"/><path d="M38 14c5 0 5 8-2 9"/><path ${A} stroke-width="1.8" d="M12.5 14.5l4 13M33.5 14.5l-4 13M19 12.5l7.5 17M27 12.5l-7.5 17"/>`,
    melitta: `<path d="M9 11h28l-8.5 21h-11z"/><path d="M37 13.5c5 0 5 8.5-2.5 9.5"/><path d="M12 37h22"/><path d="M18.5 32v5M27.5 32v5"/><path ${A} d="M14 16h18"/><circle ${A} cx="23" cy="28.5" r="1.4"/>`,
    chemex: `<path d="M12 6h24"/><path d="M12 6l10 15M36 6L26 21"/><path d="M22 26c-8 4-11 13-8 16h20c3-3 0-12-8-16"/><path ${AF} d="M19 20h10l-1.2 6.5h-7.6z"/><path ${A} d="M24 26.5l2.5 5"/>`,
    clever: `<path d="M9 10h30"/><path d="M22 10V7h4v3"/><path d="M10 14h28l-8 19h-12z"/><path d="M38 16c5 0 5 8-2 9"/><path d="M14 40h20"/><path d="M18 33l-2 7M30 33l2 7"/><rect ${AF} x="21" y="33" width="6" height="4" rx="1"/>`,
    aeropress: `<path d="M15 6h18"/><rect x="19" y="6" width="10" height="11"/><rect x="16.5" y="17" width="15" height="21" rx="1.5"/><path d="M20 25h4M20 30h4"/><path ${A} stroke-width="3.2" d="M19.5 18.6h9"/><path ${A} d="M14 41h20"/>`,
    'prensa-francesa': `<rect x="11" y="15" width="21" height="26" rx="2.5"/><path d="M9 15h25"/><path d="M21.5 15V8"/><circle ${AF} cx="21.5" cy="6" r="2.2"/><path d="M32 19h4a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-4"/><path ${A} d="M12 25h19"/><path ${A} stroke-width="1.6" d="M14 28.5h15"/>`,
    'coador-pano': `<path d="M8 42h26"/><path d="M11 42V9h6"/><ellipse cx="25" cy="10" rx="9" ry="2.6"/><path ${A} d="M16 10.5c.5 10 4.5 17 9 17s8.5-7 9-17"/><path d="M19 33h12v6H19z"/>`,
    'cold-brew': `<rect x="13" y="6.5" width="22" height="5" rx="1.2"/><path d="M14.5 11.5v2.2c-1.5 1-2.5 2.2-2.5 3.8v20a4 4 0 0 0 4 4h16a4 4 0 0 0 4-4v-20c0-1.6-1-2.8-2.5-3.8v-2.2"/><rect ${A} x="16.5" y="23" width="7" height="7" rx="1.2" transform="rotate(-12 20 26.5)"/><rect ${A} x="25" y="28" width="7" height="7" rx="1.2" transform="rotate(10 28.5 31.5)"/>`,
    chaleira: `<path d="M13 22h18l2 18H11z"/><path d="M16.5 22c0-6.5 11-6.5 11 0"/><path d="M22 15.5v-2"/><path d="M12.5 25.5c-5 0-5 10 0 10"/><path ${A} d="M32 31c5 0 6-9 11-12.5"/>`,
    personalizado: `<rect x="8" y="8" width="32" height="32" rx="7" stroke-dasharray="4 3.2"/><path ${A} d="M24 16v16M16 24h16"/>`
  };
  const NOMES = {
    espresso: 'Espresso', moka: 'Moka', v60: 'Cônico (V60)', origami: 'Cônico pregueado (Origami)', suiren: 'Cônico em pétalas (Suiren)', kalita: 'Fundo plano ondulado', b75: 'Fundo plano facetado', melitta: 'Trapezoidal',
    chemex: 'Chemex', clever: 'Imersão com válvula', aeropress: 'AeroPress', 'prensa-francesa': 'Prensa', 'coador-pano': 'Coador de pano', 'cold-brew': 'Pote (cold brew)', chaleira: 'Chaleira'
  };
  function svg(key, cls) {
    const body = D[key] || D.chaleira;
    return `<svg class="m-ico${cls ? ' ' + cls : ''}" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }
  // métodos do banco nativo: emoji → ícone de traço
  (window.CAFE_DB.metodos || []).forEach((m) => { m.ico = m.ico || m.id; m.icone = svg(m.ico); });
  const escolhas = Object.keys(NOMES).map((k) => ({ id: k, nome: NOMES[k] }));
  return { svg, escolhas, tem: (k) => !!D[k] };
})();
