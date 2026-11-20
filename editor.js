/* Tesis Altiva — editor visual ("tipo Illustrator")
   Para pulir detalles a mano sobre la página:
   · clic: elige un elemento (Alt + clic: el contenedor); Esc lo suelta
   · arrastrar o flechas: lo mueve (Mayús: de a 10 px y en un solo eje)
   · tirador de la derecha: cambia el ancho, con imán a 1, 2 o 3 columnas
   · panel: tipografía, color, espacios en renglones; para ese elemento o para
     todos los de su tipo (como un estilo de párrafo)
   · Ctrl/Cmd + Mayús + < > : achica o agranda el cuerpo; Ctrl/Cmd + Z: deshacer
   Los cambios quedan guardados en este navegador y se copian como CSS.      */
(() => {
  'use strict';
  const D = document, W = window, R = D.documentElement;
  const KEY = 'tesis-altiva-editor-' + (D.documentElement.dataset.build || 'v1');   // cambia con cada versión del sitio
  const $ = (s, r = D) => r.querySelector(s);
  const $$ = (s, r = D) => Array.from(r.querySelectorAll(s));
  const rnd = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* tipos de elemento: del más específico al más general */
  const ROLES = [
    ['.cv-title', 'Título de portada'], ['.cv-kicker', 'Rótulo de portada'], ['.cv-btns .btn', 'Botón de portada'],
    ['.cv-k', 'Rótulo de la ficha'], ['.cv-meta dt', 'Ficha: dato'], ['.cv-dni', 'Ficha: DNI'], ['.cv-meta dd', 'Ficha: valor'],
    ['.au-k', 'Autoridades: grupo'], ['.au-g dt', 'Autoridades: cargo'], ['.au-g dd', 'Autoridades: nombre'],
    ['.op-tab', 'Apertura: número'], ['.op-title', 'Apertura: título'], ['.op-dek', 'Apertura: bajada'],
    ['.op-read', 'Apertura: lectura estimada'], ['.op-toc .num', 'Apertura: número de capítulo'], ['.op-toc .t', 'Apertura: capítulo'],
    ['.hrow.lv1 .ttl', 'Título de parte'], ['.hrow.lv2 .ttl', 'Título de capítulo'], ['.hrow.lv3 .ttl', 'Título de subapartado'],
    ['.rail .num', 'Número en la columna de rótulos'], ['.num-in', 'Número sobre el título'],
    ['.lede', 'Copete (primer párrafo)'], ['.closing', 'Párrafo de cierre'],
    ['.blk.statement p', 'Enunciado (objetivo general)'], ['.o-n', 'Número de objetivo'], ['.blk.objectives p', 'Texto de objetivo'],
    ['.runin', 'Subtítulo dentro del texto'], ['blockquote.apa p', 'Cita en bloque'], ['blockquote:not(.apa) p', 'Cita'],
    ['.message', 'Mensaje de chat'],
    ['.fig-num', 'Número de figura'], ['.tab-head .fig-title', 'Título de cuadro'], ['.fig-head .fig-title', 'Título de figura'],
    ['.fig-note', 'Nota de figura'], ['.fig-media img', 'Imagen de figura'],
    ['.cd-w', 'Cadena: palabra'], ['.cd-n', 'Cadena: número'],
    ['.t-k', 'Número de bloque'], ['.t-ttl', 'Título de bloque'], ['.pe-n', 'Nombre de persona'], ['.pe-r', 'Rol de persona'],
    ['.chip', 'Palabra clave'], ['.blk thead th', 'Cuadro: encabezado'], ['.blk tbody th', 'Cuadro: primera columna'], ['.blk td', 'Cuadro: celda'],
    ['.biblio li', 'Referencia bibliográfica'], ['.notes-list li', 'Nota'],
    ['.toc-p > a .t', 'Índice: parte'], ['.toc-p ol a .t', 'Índice: capítulo'], ['.toc .num', 'Índice: número'],
    ['.pn-t', 'Anterior / Siguiente: título'], ['.ax-t', 'Anexo: título'], ['.ax-n', 'Anexo: número'],
    ['.lab', 'Rótulo en mayúsculas'], ['.flow p.note', 'Nota dentro del texto'],
    ['.flow li:not(.notes-list li):not(.biblio li)', 'Ítem de lista'],
    ['.flow p:not(.lede):not(.closing):not(.note):not(.runin)', 'Párrafo'], ['.btn:not(.cv-btns .btn)', 'Botón']
  ];
  const TAGS = { P: 'Párrafo', LI: 'Ítem', IMG: 'Imagen', FIGURE: 'Figura', FIGCAPTION: 'Epígrafe', H1: 'Título', H2: 'Título', H3: 'Título',
    H4: 'Título', BLOCKQUOTE: 'Cita', TABLE: 'Cuadro', TD: 'Celda', TH: 'Celda', A: 'Enlace', BUTTON: 'Botón', SPAN: 'Texto', DIV: 'Caja',
    SECTION: 'Sección', HEADER: 'Encabezado', NAV: 'Navegación', OL: 'Lista', UL: 'Lista', DL: 'Lista', DT: 'Dato', DD: 'Valor' };
  const SW = [['Tinta', 'var(--tinta)', '#242013'], ['Gris', 'var(--gris)', '#6B6E66'], ['Verde', 'var(--oliva)', '#3F4424'],
    ['Musgo', 'var(--musgo)', '#505941'], ['Crema', 'var(--crema)', '#DED2BC'], ['Blanco', 'var(--blanco)', '#FFFFFF']];

  let st = { rules: {}, grid: false, snap: true, pos: null };
  try {
    const s = JSON.parse(W.localStorage.getItem(KEY) || 'null');
    if (s && s.rules) st = Object.assign(st, s);
  } catch (e) { /* sin almacenamiento */ }

  /* ----------------------------------------------------------- reglas */
  const sheet = D.createElement('style');
  sheet.id = 'editor-css';
  D.head.appendChild(sheet);

  function decl(p, imp) {
    const i = imp ? ' !important' : '';
    const o = [];
    if (p.family) o.push(`font-family: var(--${p.family})${i}`);
    if (p.size != null) o.push(`font-size: ${p.size}px${i}`);
    if (p.weight != null) o.push(`font-weight: ${p.weight}${i}`);
    if (p.lh != null) o.push(`line-height: ${p.lh}px${i}`);
    if (p.ls != null) o.push(`letter-spacing: ${p.ls}em${i}`);
    if (p.upper != null) o.push(`text-transform: ${p.upper ? 'uppercase' : 'none'}${i}`);
    if (p.italic != null) o.push(`font-style: ${p.italic ? 'italic' : 'normal'}${i}`);
    if (p.color) o.push(`color: ${p.color}${i}`);
    if (p.w != null) {
      if (p.w === 'auto') o.push(`max-width: none${i}`);
      else if (/^\dc$/.test(p.w)) { const k = parseInt(p.w, 10); o.push(`width: calc(var(--col) * ${k} + var(--g) * ${k - 1})${i}`, `max-width: none${i}`); }
      else o.push(`width: ${p.w}px${i}`, `max-width: none${i}`);
    }
    if (p.mt != null) o.push(`margin-top: calc(var(--lhpx) * ${p.mt})${i}`);
    if (p.mb != null) o.push(`margin-bottom: calc(var(--lhpx) * ${p.mb})${i}`);
    if (p.tx || p.ty) o.push(`translate: ${p.tx || 0}px ${p.ty || 0}px${i}`);
    return o.join('; ');
  }
  const isEl = k => k.startsWith('e|');
  const selOf = (k, boost) => {
    const s = k.slice(2);
    return isEl(k) && boost && s.startsWith('[data-e') ? s + s + s + s : s;
  };
  const rank = k => {
    if (isEl(k)) return 1e6;
    const i = ROLES.findIndex(r => r[0] === k.slice(2));
    return i < 0 ? 0 : ROLES.length - i;
  };
  const sorted = () => Object.keys(st.rules).sort((a, b) => rank(a) - rank(b));
  function apply() {
    sheet.textContent = sorted().map(k => {
      const d = decl(st.rules[k], true);
      return d ? `${selOf(k, true)} { ${d}; }` : '';
    }).filter(Boolean).join('\n');
  }
  let saveT = 0;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try { W.localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* solo en esta sesión */ }
    }, 250);
  }
  let relT = 0;
  function relayout() {
    clearTimeout(relT);
    relT = setTimeout(() => { if (W.tesisRelayout) W.tesisRelayout(); place(); }, 180);
  }
  apply();

  /* ---------------------------------------------------- deshacer / rehacer */
  const undo = [], redo = [];
  function snap() { undo.push(JSON.stringify(st.rules)); if (undo.length > 120) undo.shift(); redo.length = 0; }
  function back() {
    if (!undo.length) return;
    redo.push(JSON.stringify(st.rules)); st.rules = JSON.parse(undo.pop());
    apply(); save(); relayout(); fill();
  }
  function fwd() {
    if (!redo.length) return;
    undo.push(JSON.stringify(st.rules)); st.rules = JSON.parse(redo.pop());
    apply(); save(); relayout(); fill();
  }

  /* --------------------------------------------------------- elección */
  let on = false, sel = null, scope = 'e', dragging = false;
  const roleOf = el => { for (const r of ROLES) if (el.matches(r[0])) return r; return null; };
  const BIG = '.part-body, .sec, .flow, main, .part, .cv-ficha, .opener, .cover, body, html';
  function pick(t) {
    let el = t && (t.nodeType === 1 ? t : t.parentElement);
    if (!el || el.closest('.ed-ui')) return null;
    for (let x = el; x && x !== D.body; x = x.parentElement) {
      if (x.matches(BIG)) break;
      if (roleOf(x)) return x;
    }
    for (let x = el; x && x !== D.body; x = x.parentElement) {
      if (x.matches(BIG)) break;
      if (/block|flex|grid|list-item|table/.test(getComputedStyle(x).display)) return x;
    }
    return el.matches(BIG) ? null : el;
  }
  function pathOf(el) {
    if (el.dataset.e) return `[data-e="${el.dataset.e}"]`;
    const parts = [];
    for (let x = el; x && x !== D.body; x = x.parentElement) {
      if (x.id) { parts.unshift('#' + CSS.escape(x.id)); break; }
      const p = x.parentElement;
      if (!p) break;
      const same = Array.from(p.children).filter(c => c.tagName === x.tagName);
      parts.unshift(`${x.tagName.toLowerCase()}:nth-of-type(${same.indexOf(x) + 1})`);
    }
    return parts.join(' > ');
  }
  function kindOf(el) {
    const r = roleOf(el);
    if (r) return { sel: r[0], name: r[1] };
    const cls = Array.from(el.classList).find(c => !/^(on|here|dark|over|blk)$/.test(c));
    return { sel: cls ? '.' + cls : el.tagName.toLowerCase(), name: (TAGS[el.tagName] || 'Elemento') + (cls ? ' .' + cls : '') };
  }
  const excerpt = el => {
    const t = (el.textContent || el.getAttribute('alt') || '').replace(/\s+/g, ' ').trim();
    return t.length > 38 ? t.slice(0, 36) + '…' : t;
  };
  const keyFor = el => (scope === 'r' ? 'r|' + kindOf(el).sel : 'e|' + pathOf(el));
  const cur = () => (sel ? st.rules[keyFor(sel)] || {} : {});

  function set(props, record = true, layoutChange = true) {
    if (!sel) return;
    if (record) snap();
    const k = keyFor(sel);
    const kind = kindOf(sel);
    const p = Object.assign({}, st.rules[k] || {}, props);
    Object.keys(p).forEach(n => { if (p[n] === null || p[n] === '' || (n !== '_label' && typeof p[n] === 'number' && isNaN(p[n]))) delete p[n]; });
    p._label = scope === 'r' ? `Todos: ${kind.name}` : `Solo este: ${kind.name} «${excerpt(sel)}»`;
    if (Object.keys(p).filter(n => n !== '_label').length) st.rules[k] = p; else delete st.rules[k];
    apply(); save(); place();
    if (layoutChange) relayout();
  }

  /* ------------------------------------------------------ superposiciones */
  const hov = D.createElement('div'); hov.className = 'ed-ui ed-hov'; hov.hidden = true;
  const box = D.createElement('div'); box.className = 'ed-ui ed-sel'; box.hidden = true;
  box.innerHTML = '<span class="ed-dim"></span><i class="ed-hw" title="Ancho (con imán a las columnas)"></i>';
  const guide = D.createElement('div'); guide.className = 'ed-ui ed-guide'; guide.hidden = true;
  const cols = D.createElement('div'); cols.className = 'ed-ui ed-cols'; cols.hidden = true;
  D.body.append(cols, hov, box, guide);
  const dim = $('.ed-dim', box);

  function frame(el, f) {
    const r = el.getBoundingClientRect();
    f.style.left = `${r.left + W.scrollX}px`; f.style.top = `${r.top + W.scrollY}px`;
    f.style.width = `${r.width}px`; f.style.height = `${r.height}px`;
    return r;
  }
  function grid() {
    const pb = $$('.part-body').find(p => p.offsetParent) || $('.part-body');
    if (!pb) return { tracks: [] };
    const cs = getComputedStyle(pb);
    const r = pb.getBoundingClientRect();
    const gap = parseFloat(cs.columnGap) || 0;
    let x = r.left + (parseFloat(cs.paddingLeft) || 0);
    const tracks = cs.gridTemplateColumns.split(' ').map(v => parseFloat(v)).filter(v => !isNaN(v)).map(w => {
      const t = [x, x + w]; x += w + gap; return t;
    });
    return { tracks, gap };
  }
  function colWidth() {
    const g = grid();
    return g.tracks.length > 1 ? { w: g.tracks[1][1] - g.tracks[1][0], gap: g.gap } : null;
  }
  function edges() {
    const out = [];
    grid().tracks.forEach(t => { out.push(t[0], t[1]); });
    return out;
  }
  function drawCols() {
    cols.hidden = !(on && st.grid);
    R.classList.toggle('ver-reticula', !!st.grid && on);
    if (cols.hidden) return;
    const g = grid();
    const last = g.tracks.length - 1;
    cols.innerHTML = g.tracks.map((t, i) => (i === last && g.tracks.length > 2 ? '' :
      `<i class="${i === 0 ? 'lab' : ''}" style="left:${t[0]}px;width:${t[1] - t[0]}px"></i>`)).join('');
  }
  function place() {
    if (!on) return;
    if (sel && sel.isConnected) {
      const r = frame(sel, box); box.hidden = false;
      const cw = colWidth();
      let c = '';
      if (cw) { const k = (r.width + cw.gap) / (cw.w + cw.gap); if (Math.abs(k - Math.round(k)) < 0.03 && Math.round(k) > 0) c = ` · ${Math.round(k)} col`; }
      const fs = parseFloat(getComputedStyle(sel).fontSize);
      dim.textContent = `${Math.round(r.width)} × ${Math.round(r.height)} px${c} · cuerpo ${rnd(fs)} px`;
    } else box.hidden = true;
    drawCols();
  }
  let rafT = 0;
  const later = () => { if (!rafT) rafT = requestAnimationFrame(() => { rafT = 0; place(); }); };
  W.addEventListener('scroll', later, { passive: true });
  W.addEventListener('resize', later);

  /* ------------------------------------------------------------- panel */
  const panel = D.createElement('aside');
  panel.className = 'ed-ui ed-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Editor visual');
  panel.innerHTML = `
    <div class="ed-top" title="Arrastrá para mover el panel"><p class="ed-k">Edición</p>
      <button class="ed-btn ed-done" type="button">Listo</button></div>
    <div class="ed-opts">
      <label><input type="checkbox" data-o="grid"> Ver retícula</label>
      <label><input type="checkbox" data-o="snap"> Imán</label>
    </div>
    <div class="ed-empty"><p>Hacé clic en cualquier elemento de la página para elegirlo.</p>
      <ul><li>Arrastralo o usá las flechas para moverlo (Mayús: de a 10 px).</li>
      <li>Tirador de la derecha: ancho, con imán a las columnas.</li>
      <li>Alt + clic: elige el contenedor. Esc: suelta.</li>
      <li>Ctrl/Cmd + Mayús + &lt; &gt;: cuerpo más chico o más grande.</li>
      <li>Ctrl/Cmd + Z: deshacer.</li></ul></div>
    <div class="ed-body" hidden>
      <p class="ed-what"><b class="ed-name"></b><span class="ed-ex"></span></p>
      <div class="ed-row ed-scope">
        <label><input type="radio" name="ed-scope" value="e" checked> Solo este</label>
        <label><input type="radio" name="ed-scope" value="r"> <span class="ed-all">Todos los de este tipo</span></label>
      </div>
      <button class="ed-link ed-up" type="button">Elegir el contenedor</button>
      <h3>Tipografía</h3>
      <div class="ed-row ed-seg" data-f="family"><button type="button" data-v="serif">Serif</button><button type="button" data-v="sans">Sans</button></div>
      <div class="ed-grid2">
        <label>Cuerpo (px)<span class="ed-num"><button type="button" data-step="-0.5" data-n="size">−</button><input type="number" step="0.5" data-n="size"><button type="button" data-step="0.5" data-n="size">+</button></span></label>
        <label>Peso<select data-n="weight"><option>300</option><option>400</option><option>500</option><option>600</option><option>700</option></select></label>
        <label>Interlineado (px)<span class="ed-num"><button type="button" data-step="-0.5" data-n="lh">−</button><input type="number" step="0.5" data-n="lh"><button type="button" data-step="0.5" data-n="lh">+</button></span></label>
        <label>Espaciado (em)<span class="ed-num"><button type="button" data-step="-0.01" data-n="ls">−</button><input type="number" step="0.01" data-n="ls"><button type="button" data-step="0.01" data-n="ls">+</button></span></label>
      </div>
      <div class="ed-row ed-seg" data-f="toggles"><button type="button" data-t="upper">MAYÚSCULAS</button><button type="button" data-t="italic"><i>Cursiva</i></button></div>
      <div class="ed-row ed-colors">${SW.map(s => `<button type="button" class="ed-sw" data-c="${s[1]}" title="${s[0]}" style="background:${s[2]}"></button>`).join('')}
        <input type="color" data-n="color" title="Otro color"></div>
      <h3>Caja</h3>
      <div class="ed-row ed-seg" data-f="w"><button type="button" data-v="1c">1 col</button><button type="button" data-v="2c">2 col</button><button type="button" data-v="3c">3 col</button><button type="button" data-v="auto">Libre</button></div>
      <div class="ed-grid2">
        <label>Espacio arriba (renglones)<span class="ed-num"><button type="button" data-step="-0.5" data-n="mt">−</button><input type="number" step="0.5" data-n="mt"><button type="button" data-step="0.5" data-n="mt">+</button></span></label>
        <label>Espacio abajo (renglones)<span class="ed-num"><button type="button" data-step="-0.5" data-n="mb">−</button><input type="number" step="0.5" data-n="mb"><button type="button" data-step="0.5" data-n="mb">+</button></span></label>
        <label>Mover X (px)<span class="ed-num"><button type="button" data-step="-1" data-n="tx">−</button><input type="number" step="1" data-n="tx"><button type="button" data-step="1" data-n="tx">+</button></span></label>
        <label>Mover Y (px)<span class="ed-num"><button type="button" data-step="-1" data-n="ty">−</button><input type="number" step="1" data-n="ty"><button type="button" data-step="1" data-n="ty">+</button></span></label>
      </div>
      <div class="ed-row ed-acts"><button class="ed-btn ed-reset" type="button">Restablecer</button>
        <button class="ed-btn ed-undo" type="button" title="Ctrl/Cmd + Z">Deshacer</button><button class="ed-btn ed-redo" type="button" title="Ctrl/Cmd + Mayús + Z">Rehacer</button></div>
    </div>
    <div class="ed-foot"><p class="ed-count"></p>
      <div class="ed-row"><button class="ed-btn solid ed-copy" type="button">Copiar cambios</button><button class="ed-btn ed-clear" type="button">Borrar todo</button></div>
      <p class="ed-msg" role="status" aria-live="polite"></p>
      <textarea class="ed-out" readonly hidden aria-label="Cambios para copiar"></textarea></div>`;
  D.body.appendChild(panel);
  const P = s => $(s, panel);
  const msg = P('.ed-msg'), out = P('.ed-out');

  if (st.pos) { panel.style.left = st.pos[0] + 'px'; panel.style.top = st.pos[1] + 'px'; panel.style.right = 'auto'; panel.style.bottom = 'auto'; }

  function count() {
    const n = Object.keys(st.rules).length;
    P('.ed-count').textContent = n ? `${n} ${n === 1 ? 'cambio guardado' : 'cambios guardados'} en este navegador` : 'Sin cambios todavía';
  }
  const hex = c => {
    const m = String(c).match(/\d+(\.\d+)?/g);
    if (!m || m.length < 3) return '#000000';
    return '#' + m.slice(0, 3).map(v => (+v).toString(16).padStart(2, '0')).join('');
  };
  function fill() {
    count();
    const has = !!sel;
    P('.ed-empty').hidden = has;
    P('.ed-body').hidden = !has;
    if (!has) return;
    const k = kindOf(sel);
    P('.ed-name').textContent = k.name;
    P('.ed-ex').textContent = excerpt(sel) ? ` «${excerpt(sel)}»` : '';
    P('.ed-all').textContent = `Todos: ${k.name}`;
    panel.querySelectorAll('input[name="ed-scope"]').forEach(r => { r.checked = r.value === scope; });
    const cs = getComputedStyle(sel);
    const p = cur();
    const fs = parseFloat(cs.fontSize);
    const lh = parseFloat(cs.lineHeight);
    const v = {
      size: rnd(fs), weight: String(Math.round(parseFloat(cs.fontWeight) / 100) * 100),
      lh: isNaN(lh) ? rnd(fs * 1.2) : rnd(lh), ls: cs.letterSpacing === 'normal' ? 0 : rnd(parseFloat(cs.letterSpacing) / fs, 3),
      mt: p.mt != null ? p.mt : 0, mb: p.mb != null ? p.mb : 0, tx: p.tx || 0, ty: p.ty || 0, color: hex(cs.color)
    };
    panel.querySelectorAll('[data-n]').forEach(i => {
      if (i.tagName === 'BUTTON') return;
      if (document.activeElement !== i) i.value = v[i.dataset.n];
    });
    const fam = /Source Serif|Newsreader|Georgia|serif\b/.test(cs.fontFamily) && !/Inter/.test(cs.fontFamily.split(',')[0]) ? 'serif' : 'sans';
    panel.querySelectorAll('[data-f="family"] button').forEach(b => b.classList.toggle('on', b.dataset.v === fam));
    panel.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === 'upper' ? cs.textTransform === 'uppercase' : cs.fontStyle === 'italic'));
    panel.querySelectorAll('[data-f="w"] button').forEach(b => b.classList.toggle('on', p.w === b.dataset.v));
  }

  /* entradas del panel */
  const LAYOUT = new Set(['size', 'lh', 'ls', 'family', 'weight', 'upper', 'w', 'mt', 'mb']);
  panel.addEventListener('input', e => {
    const i = e.target;
    if (!i.dataset.n || i.tagName === 'BUTTON') return;
    const n = i.dataset.n;
    if (n === 'color') { set({ color: i.value }, true, false); return; }
    const val = n === 'weight' ? parseInt(i.value, 10) : parseFloat(i.value);
    if (isNaN(val)) return;
    set({ [n]: val }, true, LAYOUT.has(n));
  });
  panel.addEventListener('change', e => {
    const i = e.target;
    if (i.name === 'ed-scope') { scope = i.value; fill(); place(); return; }
    if (i.dataset.o) {
      st[i.dataset.o] = i.checked; save(); drawCols();
    }
  });
  panel.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.step) {
      const n = b.dataset.n;
      const inp = panel.querySelector(`input[data-n="${n}"]`);
      const now = parseFloat(inp.value) || 0;
      const nv = rnd(now + parseFloat(b.dataset.step), n === 'ls' ? 3 : 1);
      inp.value = nv;
      set({ [n]: nv }, true, LAYOUT.has(n));
      return;
    }
    const f = b.parentElement.dataset.f;
    if (f === 'family') { set({ family: b.dataset.v }); fill(); return; }
    if (f === 'w') { set({ w: b.dataset.v }); fill(); return; }
    if (b.dataset.t) {
      const cs = getComputedStyle(sel);
      const nowOn = b.dataset.t === 'upper' ? cs.textTransform === 'uppercase' : cs.fontStyle === 'italic';
      set({ [b.dataset.t]: !nowOn }); fill(); return;
    }
    if (b.dataset.c) { set({ color: b.dataset.c }, true, false); fill(); return; }
    if (b.classList.contains('ed-up')) { if (sel && sel.parentElement && !sel.parentElement.matches('body, html')) select(sel.parentElement); return; }
    if (b.classList.contains('ed-reset')) { if (sel) { snap(); delete st.rules[keyFor(sel)]; apply(); save(); relayout(); fill(); } return; }
    if (b.classList.contains('ed-undo')) { back(); return; }
    if (b.classList.contains('ed-redo')) { fwd(); return; }
    if (b.classList.contains('ed-done')) { close(); return; }
    if (b.classList.contains('ed-clear')) {
      if (!Object.keys(st.rules).length) return;
      if (!W.confirm('¿Borrar todos los cambios hechos con el editor?')) return;
      snap(); st.rules = {}; apply(); save(); relayout(); fill();
      msg.textContent = 'Listo: la página volvió a la versión publicada.';
      return;
    }
    if (b.classList.contains('ed-copy')) {
      const text = exportText();
      if (!text) { msg.textContent = 'Todavía no hay cambios para copiar.'; return; }
      const ok = () => { msg.textContent = 'Cambios copiados. Pegalos en el chat y los fijo en la tesis.'; out.hidden = true; };
      const manual = () => { out.hidden = false; out.value = text; out.focus(); out.select(); msg.textContent = 'Copiá el texto de abajo y pegalo en el chat.'; };
      try {
        if (navigator.clipboard && W.isSecureContext) navigator.clipboard.writeText(text).then(ok, manual); else manual();
      } catch (err) { manual(); }
    }
  });
  function exportText() {
    const keys = sorted();
    if (!keys.length) return '';
    const vw = `${W.innerWidth} × ${W.innerHeight}`;
    return `/* Ajustes hechos a mano en la web de la tesis (${new Date().toLocaleString('es-AR')}, pantalla de ${vw}) */\n\n` +
      keys.map(k => {
        const p = st.rules[k];
        const d = decl(p, false);
        return d ? `/* ${p._label || ''} */\n${selOf(k, false)} { ${d}; }` : '';
      }).filter(Boolean).join('\n\n');
  }

  /* panel flotante: se arrastra desde la barra de arriba */
  P('.ed-top').addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    const r = panel.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const mv = ev => {
      const x = Math.min(Math.max(0, ev.clientX - dx), W.innerWidth - r.width);
      const y = Math.min(Math.max(0, ev.clientY - dy), W.innerHeight - 60);
      panel.style.left = x + 'px'; panel.style.top = y + 'px'; panel.style.right = 'auto'; panel.style.bottom = 'auto';
      st.pos = [x, y];
    };
    const up = () => { W.removeEventListener('pointermove', mv); W.removeEventListener('pointerup', up); save(); };
    W.addEventListener('pointermove', mv); W.addEventListener('pointerup', up);
  });

  /* --------------------------------------------------------- selección */
  function select(el) {
    sel = el;
    scope = 'e';          /* cada elemento nuevo arranca en "Solo este" */
    hov.hidden = true;
    fill(); place();
  }
  D.addEventListener('click', e => {
    if (!on || e.target.closest('.ed-ui')) return;
    e.preventDefault(); e.stopPropagation();
    let el = pick(e.target);
    if (el && e.altKey && el.parentElement && !el.parentElement.matches('body, html')) el = el.parentElement;
    if (el) select(el);
  }, true);
  D.addEventListener('pointermove', e => {
    if (!on || dragging) return;
    const el = e.target.closest && e.target.closest('.ed-ui') ? null : pick(e.target);
    if (!el || el === sel) { hov.hidden = true; return; }
    frame(el, hov); hov.hidden = false;
  }, { passive: true });

  /* mover arrastrando, con imán a los bordes de columna y a medio renglón */
  const lineH = () => {
    const f = sel && (sel.closest('.flow') || $('.flow'));
    return f ? parseFloat(getComputedStyle(f).lineHeight) || 27 : 27;
  };
  box.addEventListener('pointerdown', e => {
    if (!sel) return;
    e.preventDefault();
    const resize = e.target.classList.contains('ed-hw');
    box.setPointerCapture(e.pointerId);
    dragging = true;
    snap();
    const p0 = Object.assign({}, cur());
    const r0 = sel.getBoundingClientRect();
    const x0 = e.clientX, y0 = e.clientY;
    const ed = edges();
    const cw = colWidth();
    const mv = ev => {
      let dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (resize) {
        let w = Math.max(24, r0.width + dx);
        let wv = Math.round(w);
        guide.hidden = true;
        if (st.snap && !ev.altKey && cw) {
          for (let k = 1; k <= 3; k++) {
            const cand = cw.w * k + cw.gap * (k - 1);
            if (Math.abs(w - cand) < 12) { wv = `${k}c`; w = cand; guideAt(r0.left + cand); break; }
          }
        }
        set({ w: wv }, false, false);
        return;
      }
      if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      guide.hidden = true;
      if (st.snap && !ev.altKey) {
        const left = r0.left + dx;
        for (const x of ed) if (Math.abs(left - x) < 8) { dx = x - r0.left; guideAt(x); break; }
        const L = lineH() / 2;
        dy = Math.round(dy / L) * L;
      }
      set({ tx: rnd((p0.tx || 0) + dx), ty: rnd((p0.ty || 0) + dy) }, false, false);
    };
    const up = () => {
      box.removeEventListener('pointermove', mv); box.removeEventListener('pointerup', up);
      dragging = false; guide.hidden = true;
      if (resize) relayout();
      fill();
    };
    box.addEventListener('pointermove', mv); box.addEventListener('pointerup', up);
  });
  function guideAt(x) { guide.style.left = `${x}px`; guide.hidden = false; }
  /* doble clic: entra en lo que hay adentro (una palabra, un enlace, una imagen) */
  box.addEventListener('dblclick', e => {
    box.hidden = true;
    const t = D.elementFromPoint(e.clientX, e.clientY);
    box.hidden = false;
    if (!t || t.closest('.ed-ui')) return;
    const el = pick(t);
    if (el && el !== sel) select(el);
    else if (t !== sel && sel && sel.contains(t)) select(t);
  });

  /* teclado */
  D.addEventListener('keydown', e => {
    if (!on) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) fwd(); else back(); return; }
    if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); fwd(); return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (sel) select(null); else close(); return; }
    if (!sel) return;
    if (mod && e.shiftKey && (e.key === '>' || e.code === 'Period' || e.key === '<' || e.code === 'Comma' || e.code === 'IntlBackslash')) {
      e.preventDefault();
      const up = e.key === '>' || e.code === 'Period';
      const fs = parseFloat(getComputedStyle(sel).fontSize);
      set({ size: rnd(fs + (up ? 1 : -1)) });
      fill();
      return;
    }
    const step = e.shiftKey ? 10 : 1;
    const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (mv) {
      e.preventDefault();
      const p = cur();
      set({ tx: rnd((p.tx || 0) + mv[0]), ty: rnd((p.ty || 0) + mv[1]) }, true, false);
      fill();
    }
  }, true);

  /* ------------------------------------------------------- abrir / cerrar */
  function open() {
    on = true;
    W.tesisEditing = true;
    R.classList.add('editando');
    panel.hidden = false;
    panel.querySelector('[data-o="grid"]').checked = !!st.grid;
    panel.querySelector('[data-o="snap"]').checked = st.snap !== false;
    msg.textContent = '';
    fill(); place();
  }
  function close() {
    on = false;
    W.tesisEditing = false;
    R.classList.remove('editando', 'ver-reticula');
    panel.hidden = true; box.hidden = true; hov.hidden = true; guide.hidden = true; cols.hidden = true;
    sel = null;
  }
  W.tesisEditor = { open, close, toggle: () => (on ? close() : open()) };
})();
