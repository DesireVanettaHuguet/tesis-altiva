/* Tesis Altiva — ajustes de lectura
   Dos opciones simples para quien lee: el tamaño del texto y el modo día/noche.
   Se guardan solo en este navegador.                                          */
(() => {
  'use strict';
  const D = document, W = window, R = D.documentElement;
  const KEY = 'tesis-altiva-lectura-v1';
  const TAM = [['Chico', 0.9], ['Normal', 1], ['Grande', 1.12], ['Muy grande', 1.25]];
  const VARS = ['--fs', '--fs-s', '--fs-xs', '--fs-lede', '--fs-h3', '--fs-stmt'];

  let st = { tam: 1, modo: 'dia' };
  try { Object.assign(st, JSON.parse(W.sessionStorage.getItem(KEY) || '{}')); } catch (e) { /* sin datos */ }
  const save = () => { try { W.sessionStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* sin almacenamiento */ } };

  let rT;
  const relayout = () => { clearTimeout(rT); rT = setTimeout(() => { if (W.tesisRelayout) W.tesisRelayout(); }, 140); };

  /* el cuerpo de texto cambia según la pantalla: se mide el valor de la hoja y se escala */
  function applyTam() {
    VARS.forEach(v => R.style.removeProperty(v));
    const k = TAM[st.tam] ? TAM[st.tam][1] : 1;
    if (k !== 1) {
      const css = getComputedStyle(R);
      VARS.forEach(v => {
        const px = parseFloat(css.getPropertyValue(v));
        if (!isNaN(px)) R.style.setProperty(v, (px * k).toFixed(2) + 'px');
      });
    }
  }
  function applyModo() {
    R.classList.toggle('noche', st.modo === 'noche');
    const m = D.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', st.modo === 'noche' ? '#1C1E17' : '#3F4424');
  }
  applyTam(); applyModo();
  let wW = W.innerWidth;
  W.addEventListener('resize', () => {
    if (Math.abs(W.innerWidth - wW) < 2) return;
    wW = W.innerWidth;
    if (st.tam !== 1) { applyTam(); relayout(); }
  });

  const seg = (name, opts, cur) => `<div class="aj-seg" role="radiogroup" aria-label="${name}">` +
    opts.map(([lab, val]) => `<button type="button" role="radio" data-${name === 'Tamaño del texto' ? 'tam' : 'modo'}="${val}" aria-checked="${val === cur}">${lab}</button>`).join('') + '</div>';

  const panel = D.createElement('aside');
  panel.className = 'ajustes lectura';
  panel.id = 'ajustes';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Ajustes de lectura');
  panel.innerHTML = `
    <div class="aj-top"><p class="aj-k">Ajustes de lectura</p><button class="aj-btn aj-close" type="button">Cerrar</button></div>
    <section><h3>Tamaño del texto</h3>${seg('Tamaño del texto', TAM.map((t, i) => [t[0], String(i)]), String(st.tam))}</section>
    <section><h3>Modo</h3>${seg('Modo', [['Día', 'dia'], ['Noche', 'noche']], st.modo)}</section>
    <p class="aj-note">Vale mientras tengas la página abierta.</p>`;
  D.body.appendChild(panel);

  const trigger = D.querySelector('.z-aj');
  function open() { panel.hidden = false; if (trigger) trigger.setAttribute('aria-expanded', 'true'); panel.querySelector('.aj-close').focus({ preventScroll: true }); }
  function close() {
    if (panel.hidden) return;
    panel.hidden = true;
    if (trigger) { trigger.setAttribute('aria-expanded', 'false'); trigger.focus({ preventScroll: true }); }
  }
  if (trigger) trigger.addEventListener('click', () => (panel.hidden ? open() : close()));
  panel.querySelector('.aj-close').addEventListener('click', close);
  D.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  panel.addEventListener('click', e => {
    const b = e.target.closest('button[role="radio"]');
    if (!b) return;
    b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', String(x === b)));
    if (b.dataset.tam != null) { st.tam = +b.dataset.tam; applyTam(); relayout(); }
    if (b.dataset.modo) { st.modo = b.dataset.modo; applyModo(); }
    save();
  });
})();
