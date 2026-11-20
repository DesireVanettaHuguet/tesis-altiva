/* Tesis Altiva — comportamiento de la página
   1. arma "láminas": parte el texto en filas de columnas que entran en la pantalla
   2. la línea guía se completa a medida que se lee; cada apartado es un nodo
   3. en cada apertura, las curvas del símbolo nacen de la línea
   4. índice, referencias APA y notas al pasar, figuras ampliables          */
(() => {
  'use strict';
  const D = document, W = window;
  const T = W.TESIS || { refs: {}, notes: {}, parts: [] };
  const $ = (s, r = D) => r.querySelector(s);
  const $$ = (s, r = D) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduce = W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = W.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const docTop = el => el.getBoundingClientRect().top + W.scrollY;

  const bar = $('.bar'), barProg = $('.bar-prog i'), where = $('.bar-where'), zoc = $('.zocalo');
  const bwNum = $('.bw-num'), bwT = $('.bw-t');
  let vh = W.innerHeight, vw = W.innerWidth;
  let lined = [], nodes = [], marks = [], branches = [], darks = [], heros = [];
  let ticking = false, curPartId = '', lastY = W.scrollY;
  const POS_KEY = 'tesis-altiva-lectura-v1';
  let savedId = '', saveT = 0;

  /* ------------------------------------------------ 1. filas de columnas */
  const flows = $$('.flow');
  flows.forEach((f, i) => { f.dataset.k = i; });
  const colCount = f => parseInt(getComputedStyle(f).columnCount, 10) || 1;

  function unpack() {
    $$('.flow.cont').forEach(c => {
      const orig = $(`.flow[data-k="${c.dataset.of}"]:not(.cont)`);
      while (c.firstChild) orig.appendChild(c.firstChild);
      c.remove();
    });
  }

  function weight(el, cpl, lh, colW) {
    if (el.matches('figure')) {
      const img = $('img', el), ph = $('.ph', el);
      let ratio = 4 / 3;
      if (img && img.width && img.height) ratio = img.width / img.height;
      else if (ph) { const m = (ph.style.aspectRatio || '').split('/'); if (m.length === 2) ratio = parseFloat(m[0]) / parseFloat(m[1]); }
      return ((colW / ratio) / lh + 4) * cpl;
    }
    return (el.textContent || '').length * 1.04 + cpl * 0.6;
  }

  /* módulos: cada subtítulo arranca una fila nueva, con el subtítulo arriba a todo
     el ancho y su texto bajando por la primera columna y siguiendo en la segunda */
  function splitModules(f) {
    const kids = Array.from(f.children);
    let row = f;
    kids.forEach((k, i) => {
      if (i > 0 && k.matches('.runin, .fi-k')) {
        const nr = D.createElement('div');
        nr.className = 'flow cont mod-row';
        nr.dataset.of = f.dataset.k;
        row.after(nr);
        row = nr;
      }
      if (row !== f) row.appendChild(k);
    });
  }

  function pack() {
    unpack();
    const H = Math.max(360, vh - (bar ? bar.offsetHeight : 52) - (zoc ? zoc.offsetHeight : 30) - 64);
    flows.forEach(splitModules);
    for (const f of $$('.flow')) {
      const cols = colCount(f);
      if (cols < 2 || f.offsetHeight <= H) continue;
      const cs = getComputedStyle(f);
      const fs = parseFloat(cs.fontSize);
      const lh = parseFloat(cs.lineHeight) || fs * 1.5;
      const gap = parseFloat(cs.columnGap) || 24;
      const colW = (f.clientWidth - (cols - 1) * gap) / cols;
      const cpl = colW / (0.455 * fs);
      const cap = (H / lh) * cols * cpl;
      const kids = Array.from(f.children);
      f.replaceChildren();
      let row = f, acc = 0;
      for (const k of kids) {
        row.appendChild(k);
        acc += weight(k, cpl, lh, colW);
        if (acc < cap * 0.82 || row.children.length < 2) continue;
        if (row.offsetHeight > H) {
          row.removeChild(k);
          const carry = [k];
          let last = row.lastElementChild;
          while (last && last.matches('.runin') && row.children.length > 1) {
            row.removeChild(last); carry.unshift(last); last = row.lastElementChild;
          }
          const nr = D.createElement('div');
          nr.className = 'flow cont';
          nr.dataset.of = f.dataset.k || f.dataset.of;
          row.after(nr);
          row = nr;
          acc = 0;
          carry.forEach(c => { row.appendChild(c); acc += weight(c, cpl, lh, colW); });
          /* sin subtítulo arriba: la línea corta marca dónde sigue el texto */
          if (!carry[0].matches('.runin, .fi-k')) row.classList.add('sigue');
        }
      }
    }
  }

  /* retícula de renglones: el texto ya mide renglones enteros; lo demás que va
     dentro de las columnas (figuras, palabras clave, cajas) se completa hasta el
     renglón siguiente, así las columnas vecinas quedan sobre las mismas líneas */
  function snapFlows() {
    for (const f of $$('.flow')) {
      const L = parseFloat(getComputedStyle(f).lineHeight);
      if (!L) continue;
      for (const k of f.children) {
        if (k.matches('p:not(.lede):not(.closing), ul, ol:not(.questions), .runin')) continue;
        k.style.paddingBottom = '';
        const h = k.getBoundingClientRect().height;
        const r = h % L;
        if (r > 0.5 && L - r > 0.5) {
          const pb = parseFloat(getComputedStyle(k).paddingBottom) || 0;
          k.style.paddingBottom = `${(pb + L - r).toFixed(2)}px`;
        }
      }
    }
  }

  /* fichas y cabezas de módulo: cada pieza mide renglones enteros, así el texto
     de una columna y el de la de al lado se apoyan sobre las mismas líneas */
  function snapCards() {
    const f0 = $('.flow');
    const L = f0 ? parseFloat(getComputedStyle(f0).lineHeight) : 0;
    if (!L) return;
    const pad = el => {
      el.style.paddingBottom = '';
      const h = el.getBoundingClientRect().height;
      const r = h % L;
      if (h > 0 && r > 0.5 && L - r > 0.5) {
        const pb = parseFloat(getComputedStyle(el).paddingBottom) || 0;
        el.style.paddingBottom = `${(pb + L - r).toFixed(2)}px`;
      }
    };
    $$('.mod-h').forEach(pad);
    $$('.t-cell, .anexos-list > li, .blk.objectives li, .person, .pair-cell, .uni-g').forEach(card => {
      Array.from(card.children).forEach(pad);
      pad(card);
    });
  }

  /* textos cortos que no conviene partir en dos columnas (un párrafo corto, la consigna
     de una técnica, el mensaje de la entrevista): van enteros en la primera columna.
     Hasta el 13/11 ocupaban el ancho de las dos; con las columnas más anchas del 16/11
     eso daba renglones de unos 130 caracteres, el doble de lo cómodo para leer */
  const TEXTO = 'p:not(.lede):not(.closing):not(.chips), .runin, .message';
  const soloTexto = f => f.children.length > 0 && Array.from(f.children).every(k => k.matches(TEXTO));
  const ancho = f => { f.style.columnCount = '1'; f.style.maxWidth = 'var(--measure)'; f.classList.add('una'); };

  /* copete y cierre: hasta el doble del mínimo de corte (6 renglones) van en una columna;
     si son más largos, su texto se reparte en las dos, sin dejar una columna vacía */
  function fitLede() {
    const min = parseFloat(getComputedStyle(D.documentElement).getPropertyValue('--min-corte')) || 3;
    const dosCols = W.matchMedia('(min-width: 1240px)').matches;
    for (const p of $$('p.lede, p.closing')) {
      p.classList.remove('dos');
      if (!p.offsetWidth || !dosCols) continue;
      const fl = p.closest('.flow');
      if (fl && colCount(fl) < 2) continue;
      const lh = parseFloat(getComputedStyle(p).lineHeight) || 1;
      if (Math.round(p.getBoundingClientRect().height / lh) > min * 2) p.classList.add('dos');
    }
  }

  /* textos cortos: menos columnas (nunca 1 oración partida en 3) */
  function fitCols() {
    for (const f of $$('.flow')) {
      f.style.columnCount = '';
      f.style.maxWidth = '';
      f.classList.remove('ancho', 'una');
      const cols = colCount(f);
      if (cols < 2) continue;
      /* la consigna de cada técnica va siempre a lo ancho */
      /* textos que Desiré pidió en una sola columna */
      if (f.classList.contains('f-una')) { ancho(f); continue; }
      /* Objetivo de la técnica / Ejes de indagación: dos columnas fijas, una para cada uno */
      if (f.classList.contains('par2')) continue;
      if (f.firstElementChild && f.firstElementChild.classList.contains('ancho-k') && soloTexto(f)) { ancho(f); continue; }
      const cs = getComputedStyle(f);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
      /* un solo párrafo corto (hasta el doble del mínimo de renglones por lado, 3 + 3 por
         defecto): no se parte en dos columnas angostas, va a lo ancho en todas las pantallas */
      const ps = Array.from(f.children).filter(k => k.tagName === 'P');
      if (ps.length === 1 && soloTexto(f)) {
        const min = parseFloat(getComputedStyle(D.documentElement).getPropertyValue('--min-corte')) || 3;
        const lines = Array.from(ps[0].getClientRects()).reduce((a, r) => a + Math.round(r.height / lh), 0);
        if (lines <= min * 2) { ancho(f); continue; }
      }
      const total = (f.offsetHeight * cols) / lh;
      /* al menos 3 renglones por columna: un párrafo corto igual va en 2 columnas */
      const want = clamp(Math.floor(total / 3), 1, cols);
      if (want < cols) {
        if (want === 1 && soloTexto(f)) { ancho(f); continue; }
        f.style.columnCount = want;
        f.style.maxWidth = `calc(var(--measure) * ${want} + var(--g) * ${want - 1})`;
      }
    }
  }

  /* después de no partir párrafos: si todo quedó en la primera columna, queda en una */
  function spanShort() {
    for (const f of $$('.flow')) {
      if (f.classList.contains('una') || f.classList.contains('par2') || colCount(f) < 2 || !soloTexto(f)) continue;
      const fr = f.getBoundingClientRect();
      if (!fr.width) continue;
      const n = colCount(f);
      const gap = parseFloat(getComputedStyle(f).columnGap) || 0;
      const edge = fr.left + (fr.width - gap * (n - 1)) / n + gap / 2;
      const soloPrimera = Array.from(f.children).every(k => Array.from(k.getClientRects()).every(r => r.left < edge));
      if (soloPrimera) ancho(f);
    }
  }

  /* --------------------------------------------- 2. línea, nodos, curvas */
  function drawBranches() {
    branches = [];
    $$('.branch').forEach(svg => {
      const host = svg.parentElement;
      const hr = host.getBoundingClientRect();
      const isCover = host.classList.contains('cv-ficha');
      /* aperturas: debajo de la bajada si la hay, para no cruzar el texto */
      const anchor = isCover ? $('.cv-meta', host) : ($('.op-read', host) || $('.op-dek', host) || $('.op-title', host));
      if (!anchor || !hr.width) return;
      const ar = anchor.getBoundingClientRect();
      const Wd = hr.width, Hd = hr.height;
      const m = parseFloat(getComputedStyle(host).paddingLeft) || 16;
      const d = clamp(Wd / 190, 6, 10);
      const R = clamp(Wd * 0.05, 34, 96);
      /* aperturas: el abanico nace debajo del título; portada: es el filete sobre la ficha */
      let y0 = ar.bottom - hr.top + clamp(vh * 0.028, 14, 40);
      if (isCover) y0 = ar.top - hr.top - 2 * d - 22;
      const Rr = Math.min(R, y0 - 12);
      /* las curvas terminan donde termina la última columna de texto (el área viva) */
      let xEnd = Wd - m;
      const tr = getComputedStyle(host).gridTemplateColumns.split(' ').map(parseFloat).filter(v => !isNaN(v));
      if (tr.length > 2) {
        const gap = parseFloat(getComputedStyle(host).columnGap) || 0;
        xEnd = m + tr.slice(0, -1).reduce((a, w) => a + w, 0) + gap * (tr.length - 2);
      }
      svg.setAttribute('viewBox', `0 0 ${Wd} ${Hd}`);
      const paths = [0, 1, 2].map(i => {
        const yt = y0 + i * d, ys = yt - Rr;
        return { dd: `M ${m} ${ys} A ${Rr} ${Rr} 0 0 0 ${m + Rr} ${yt} H ${xEnd}`, len: Math.PI * Rr / 2 + (xEnd - m - Rr), ys };
      });
      svg.innerHTML = paths.map(p => `<path class="bb" d="${p.dd}"/>`).join('') +
        paths.map(p => `<path class="bf" d="${p.dd}" style="stroke-dasharray:${p.len.toFixed(1)};stroke-dashoffset:${p.len.toFixed(1)}"/>`).join('');
      if (isCover) {
        const line = $(':scope > .line', host);
        if (line) line.style.setProperty('--line-top', `${paths[0].ys}px`);
      }
      branches.push({ host, fills: $$('.bf', svg), paths, top: docTop(host) });
    });
  }

  function measure() {
    vh = W.innerHeight; vw = W.innerWidth;
    drawBranches();
    lined = $$('.lined').map(el => {
      const line = $(':scope > .line', el);
      return { el, fill: $('.fill', line), top: docTop(line), h: line.offsetHeight, p: -1, dark: el.classList.contains('dark') };
    });
    nodes = $$('.hrow .node').map(n => ({ n, y: docTop(n) + n.offsetHeight / 2, on: null }));
    darks = $$('.opener').map(el => { const t = docTop(el); return { t, b: t + el.offsetHeight }; });
    heros = $$('.cv-hero').map(el => { const t = docTop(el); return { t, b: t + el.offsetHeight }; });
    marks = $$('.part, .cover, .sec.lv2, .sec.lv3').map(s => ({
      y: docTop(s), num: s.dataset.num || '', t: s.dataset.title || '',
      lv: (s.classList.contains('part') || s.classList.contains('cover')) ? 1 : (s.classList.contains('lv2') ? 2 : 3),
      id: s.id
    })).sort((a, b) => a.y - b.y);
  }

  function update() {
    ticking = false;
    const y = W.scrollY;
    const readY = y + vh * 0.42;
    for (const L of lined) {
      const p = L.h > 0 ? clamp((readY - L.top) / L.h, 0, 1) : 0;
      if (Math.abs(p - L.p) > 0.0004) { L.p = p; L.fill.style.transform = `scaleY(${p.toFixed(4)})`; }
    }
    for (const N of nodes) {
      const on = N.y <= readY;
      if (on !== N.on) { N.on = on; N.n.classList.toggle('on', on); }
    }
    for (const B of branches) {
      B.paths.forEach((p, i) => {
        const q = clamp((readY - (B.top + p.ys)) / (vh * 0.38), 0, 1);
        const off = (p.len * (1 - q)).toFixed(1);
        const f = B.fills[i];
        if (f && f._o !== off) { f._o = off; f.style.strokeDashoffset = off; }
      });
    }
    /* barra superior */
    const max = D.documentElement.scrollHeight - vh;
    barProg.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1).toFixed(4) : 0})`;
    const probe = y + 120;
    let part = null, sec = null;
    for (const mk of marks) {
      if (mk.y > probe) break;
      if (mk.lv === 1) { part = mk; sec = null; } else sec = mk;
    }
    curPartId = part ? part.id : '';
    /* recordar dónde quedó la lectura */
    const here = sec || part;
    if (here && here.id && here.id !== 'portada' && here.id !== savedId && y > vh * 0.6) {
      savedId = here.id;
      clearTimeout(saveT);
      saveT = setTimeout(() => {
        try { W.localStorage.setItem(POS_KEY, JSON.stringify({ id: here.id, num: (sec ? sec.num : '') || (part ? part.num : ''), t: here.t })); } catch (e) { /* sin almacenamiento */ }
      }, 500);
    }
    if (part && part.id !== 'portada') {
      const num = sec ? (sec.num || part.num) : part.num;
      const t = sec ? sec.t : part.t;
      if (bwNum.textContent !== num) bwNum.textContent = num;
      if (bwT.textContent !== t) bwT.textContent = t;
      where.classList.add('on');
    } else {
      where.classList.remove('on');
    }
    const inAny = (list, at) => list.some(d => at >= d.t && at <= d.b);
    const mid = y + (bar.offsetHeight / 2);
    const over = inAny(heros, mid);
    bar.classList.toggle('over', over);
    bar.classList.toggle('dark', !over && inAny(darks, mid));
    if (zoc) {
      const zm = y + vh - zoc.offsetHeight / 2;
      const zo = inAny(heros, zm);
      zoc.classList.toggle('over', zo);
      zoc.classList.toggle('dark', !zo && inAny(darks, zm));
    }
    /* en celulares (vertical y apaisado) la barra y el zócalo se esconden al bajar y
       vuelven al subir: en horizontal queda toda la altura para leer */
    if (vh < 580 || W.innerWidth < 820) {
      const dy = y - lastY;
      if (dy > 6 && y > 80) bar.classList.add('hide');
      else if (dy < -6) bar.classList.remove('hide');
    } else bar.classList.remove('hide');
    if (zoc) zoc.classList.toggle('hide', bar.classList.contains('hide'));
    lastY = y;
  }

  /* si una imagen no carga (red lenta o un corte), se vuelve a pedir hasta tres veces */
  function retryImages() {
    const tries = new WeakMap();
    const again = img => {
      const n = (tries.get(img) || 0) + 1;
      const src = (img.getAttribute('src') || '').split('?')[0];
      if (n > 3 || !src) return;
      tries.set(img, n);
      W.setTimeout(() => { img.src = src + '?r=' + n; }, 700 * n);
    };
    D.addEventListener('error', e => { const t = e.target; if (t && t.tagName === 'IMG') again(t); }, true);
    $$('img').forEach(img => { if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) again(img); });
  }

  /* retículas que se construyen: se dibujan una vez, cuando la figura entra en
     pantalla; «Ver de nuevo la construcción» las repite (útil en la defensa) */
  function retAnim() {
    const lazy = $$('.zoom.anim[data-anim]');
    if ((!$$('.ret-anim').length && !lazy.length) || reduce || !('IntersectionObserver' in W)) return;
    D.documentElement.classList.add('anim-ok');
    /* arranca con el 45 % a la vista, o con media pantalla ocupada si la figura es más alta que eso */
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting && (e.intersectionRatio >= 0.45 || e.intersectionRect.height >= W.innerHeight * 0.5)) {
        e.target.classList.add('run'); io.unobserve(e.target);
      }
    }), { threshold: [0, 0.1, 0.2, 0.3, 0.45] });
    $$('.ret-anim').forEach(s => io.observe(s));
    /* las páginas del manual se piden cuando la figura se acerca */
    const near = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const z = e.target;
      near.unobserve(z);
      fetch(z.dataset.anim).then(r => (r.ok ? r.text() : '')).then(t => {
        if (!t || $('.ret-anim', z)) return;
        z.insertAdjacentHTML('beforeend', t);
        const s = $('.ret-anim', z);
        if (s) io.observe(s);
      }).catch(() => {});
    }), { rootMargin: '900px 0px' });
    lazy.forEach(z => near.observe(z));
    D.addEventListener('click', e => {
      const b = e.target.closest('.ret-otra');
      if (!b) return;
      /* todas las capas animadas de la figura (las figuras nuevas tienen un dibujo ancho y uno angosto) */
      const ss = $$('.ret-anim', b.closest('figure'));
      if (!ss.length) return;
      ss.forEach(s => s.classList.remove('run'));
      W.requestAnimationFrame(() => W.requestAnimationFrame(() => ss.forEach(s => s.classList.add('run'))));
    });
  }

  /* apertura: la hoja verde se va sola; un clic, una tecla, la ruedita o el dedo la adelantan */
  function intro() {
    const el = D.getElementById('intro');
    if (!el || el.classList.contains('fin')) return;
    const skip = () => { if (!el.classList.contains('fin')) el.classList.add('salta'); };
    el.addEventListener('animationend', e => { if (e.target === el) el.classList.add('fin'); });
    ['click', 'wheel', 'touchstart'].forEach(t => el.addEventListener(t, skip, { passive: true }));
    D.addEventListener('keydown', skip, { once: true });
  }

  function requestUpdate() {
    if (!ticking) { ticking = true; W.requestAnimationFrame(update); }
  }


  /* ancla de lectura: al rearmar las filas, la página no salta */
  function anchorNow() {
    const cands = $$('.hrow, .flow > p, .flow > figure');
    for (const el of cands) {
      const r = el.getBoundingClientRect();
      if (r.bottom > 60) return { el, top: r.top };
    }
    return null;
  }
  function restore(a) {
    if (!a || !a.el.isConnected) return;
    const r = a.el.getBoundingClientRect();
    W.scrollBy(0, r.top - a.top);
  }

  /* fichas en grilla (técnicas, objetivos, anexos…): si hay más fichas que
     columnas, se leen de arriba abajo y después a la derecha */
  function cardFlow() {
    const n = parseInt(getComputedStyle(D.documentElement).getPropertyValue('--n'), 10) || 1;
    $$('.blk.trio:not(.mods), .blk.pair, .blk.people, .blk.objectives ol, .anexos-list').forEach(b => {
      const kids = Array.from(b.children);
      const down = n > 1 && kids.length > n;
      b.classList.toggle('down', down);
      /* de arriba abajo y después a la derecha: la primera columna lleva la mitad de
         las piezas (redondeando para arriba) y la de al lado arranca arriba, como en
         una página: 1 y 2 a la izquierda, 3 al lado */
      const k = Math.ceil(kids.length / n);
      kids.forEach((c, i) => {
        const brk = down && i > 0 && i % k === 0;
        c.style.breakBefore = brk ? 'column' : '';
        c.style.setProperty('-webkit-column-break-before', brk ? 'always' : '');
      });
    });
  }

  /* párrafos enteros: un párrafo no se corta entre columnas si de un lado le quedarían
     menos de tres renglones. Va entero a una sola columna y el siguiente arranca arriba
     de la otra: la simetría no es exacta, pero se lee mejor */
  function keepParas() {
    /* renglones mínimos de cada lado del corte (Ajustes › Texto); por defecto 3 */
    const min = parseFloat(getComputedStyle(D.documentElement).getPropertyValue('--min-corte')) || 3;
    for (const f of $$('.flow')) {
      if (colCount(f) < 2) continue;
      const L = parseFloat(getComputedStyle(f).lineHeight);
      if (!L) continue;
      for (let pass = 0; pass < 6; pass++) {
        let changed = false;
        for (const p of f.children) {
          if (p.tagName !== 'P' || p.classList.contains('entera') || p.matches('.lede, .closing, .chips')) continue;
          const r = p.getClientRects();
          if (r.length < 2) continue;
          const a = Math.round(r[0].height / L), z = Math.round(r[r.length - 1].height / L);
          if (a < min || z < min) { p.classList.add('entera'); changed = true; }
        }
        if (!changed) break;
      }
    }
  }

  /* redes: el texto arranca a la altura de la imagen, no del número de figura */
  function alignPub() {
    for (const f of $$('.flow.par2.pub')) {
      const [a, b] = f.children;
      if (!a || !b) continue;
      b.style.paddingTop = '';
      const m = $('.fig-media', a);
      if (!m || getComputedStyle(f).display !== 'grid') continue;
      /* se resta el aire de arriba del renglón, así las mayúsculas tocan la línea del borde de la imagen */
      const p = b.firstElementChild, cs = p ? getComputedStyle(p) : null;
      const aire = cs ? (parseFloat(cs.lineHeight) - parseFloat(cs.fontSize) * .72) / 2 : 0;
      b.style.paddingTop = `${Math.max(0, m.getBoundingClientRect().top - a.getBoundingClientRect().top - aire)}px`;
    }
  }
  function layout() {
    $$('.flow p.entera').forEach(p => p.classList.remove('entera'));
    cardFlow();
    snapCards();
    pack();
    fitLede();
    fitCols();
    snapFlows();
    keepParas();
    spanShort();
    alignPub();
    measure();
    update();
  }
  /* para el panel de ajustes: rearmar sin que la página salte */
  W.tesisRelayout = () => { const a = anchorNow(); layout(); restore(a); measure(); update(); };

  /* ------------------------------------------------------------ 3. índice */
  const panel = $('#indice-panel'), btn = $('.bar-index');
  function markHere() {
    $$('.toc-p', panel).forEach(li => li.classList.toggle('here', li.dataset.for === curPartId));
  }
  function openPanel() {
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    D.body.classList.add('locked');
    markHere();
    const here = $('.toc-p.here > a', panel) || $('a', panel);
    if (here) {
      here.focus({ preventScroll: true });
      here.scrollIntoView({ block: 'center' });
    }
  }
  function closePanel(keepFocus) {
    if (panel.hidden) return;
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    D.body.classList.remove('locked');
    if (!keepFocus) btn.focus({ preventScroll: true });
  }
  btn.addEventListener('click', () => (panel.hidden ? openPanel() : closePanel()));
  $$('[data-open-index]').forEach(b => b.addEventListener('click', () => openPanel()));
  $('.panel-close', panel).addEventListener('click', () => closePanel());
  panel.addEventListener('click', e => { if (e.target.closest('a')) closePanel(true); });

  /* ------------------------------------------- 4. referencias y notas */
  const pop = $('.pop');
  let popFor = null, hideT = 0, showT = 0;
  const TRIG = 'a.cite, sup.fn a';
  function popHTML(a) {
    if (a.dataset.ref && T.refs[a.dataset.ref]) {
      return `<span class="pop-k">Referencia</span>${T.refs[a.dataset.ref]}<br><a class="pop-go" href="#ref-${a.dataset.ref}">Ver en la bibliografía</a>`;
    }
    if (a.dataset.note && T.notes[a.dataset.note]) {
      return `<span class="pop-k">Nota ${a.dataset.note}</span>${T.notes[a.dataset.note]}`;
    }
    return '';
  }
  function showPop(a) {
    if (W.tesisEditing) return;
    const h = popHTML(a);
    if (!h) return;
    clearTimeout(hideT);
    pop.innerHTML = h;
    pop.hidden = false;
    popFor = a;
    const r = a.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    const x = clamp(r.left + r.width / 2 - pw / 2, 12, vw - pw - 12);
    let y = r.bottom + 10;
    if (y + ph > vh - 12) y = r.top - ph - 10;
    pop.style.left = `${x}px`;
    pop.style.top = `${Math.max(12, y)}px`;
  }
  function hidePop(now) {
    clearTimeout(hideT);
    hideT = setTimeout(() => { pop.hidden = true; popFor = null; }, now ? 0 : 180);
  }
  D.addEventListener('click', e => {
    const a = e.target.closest(TRIG);
    if (a) {
      e.preventDefault();
      if (popFor === a && !pop.hidden) hidePop(true); else showPop(a);
      return;
    }
    const go = e.target.closest('.pop-go');
    if (go) {
      /* ir a la referencia con JS: el visor de claude.ai no siempre sigue los enlaces internos */
      e.preventDefault();
      hidePop(true);
      const t = D.getElementById(go.getAttribute('href').slice(1));
      if (t) {
        t.scrollIntoView({ block: 'center', behavior: W.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash');
      }
      return;
    }
    if (!e.target.closest('.pop')) hidePop(true);
  });
  if (fine) {
    D.addEventListener('mouseover', e => {
      const a = e.target.closest(TRIG);
      if (a) { clearTimeout(showT); clearTimeout(hideT); showT = setTimeout(() => showPop(a), 110); }
      else if (e.target.closest('.pop')) clearTimeout(hideT);
    });
    D.addEventListener('mouseout', e => {
      if (e.target.closest(TRIG) || e.target.closest('.pop')) { clearTimeout(showT); hidePop(); }
    });
  }
  D.addEventListener('focusin', e => { const a = e.target.closest(TRIG); if (a) showPop(a); });

  /* ------------------------------------------------------- 5. ampliar */
  const lb = $('.lightbox'), lbImg = $('img', lb), lbCap = $('figcaption', lb);
  let lbFrom = null, gal = null;
  function showGal() {
    lbImg.src = `${gal.base}${String(gal.n + 1).padStart(2, '0')}.webp`;
    lbImg.alt = `${gal.title}, página ${gal.n + 1}`;
    lbCap.textContent = `${gal.title} · página ${gal.n + 1} de ${gal.total}`;
  }
  function stepGal(k) { if (!gal) return; gal.n = (gal.n + k + gal.total) % gal.total; showGal(); }
  /* «Ver la hoja firmada»: abre la vista previa en grande (el visor de Claude bloquea abrir el PDF aparte) */
  D.addEventListener('click', e => {
    const v = e.target.closest('.aval-ver');
    if (!v) return;
    const z = $('.aval-hoja .zoom');
    if (z) z.click();
  });
  D.addEventListener('click', e => {
    const z = e.target.closest('.zoom');
    if (!z) return;
    const img = $('img', z);
    const fig = z.closest('figure');
    gal = null;
    if (img.dataset.gal) {
      /* página que se tocó, según la grilla de la lámina */
      const r = img.getBoundingClientRect(), d = img.dataset;
      const c = +d.gc, gw = +d.gw, gh = +d.gh, gg = +d.gg, cw = (gw - gg * (c - 1)) / c;
      const rows = Math.ceil(+d.gn / c), ch = (gh - gg * (rows - 1)) / rows;
      const x = (e.clientX - r.left) / r.width * gw, y = (e.clientY - r.top) / r.height * gh;
      let n = Math.floor(y / (ch + gg)) * c + Math.floor(x / (cw + gg));
      n = Math.max(0, Math.min(+d.gn - 1, n));
      gal = { base: d.gal, n, total: +d.gn, title: fig ? $('.fig-title', fig).textContent : '' };
    }
    lb.classList.toggle('gal', !!gal);
    $('.lb-prev', lb).hidden = $('.lb-next', lb).hidden = !gal;
    if (gal) { showGal(); } else
    lbImg.src = img.dataset.full || img.currentSrc || img.src;
    lbImg.alt = img.alt;
    if (gal) { /* epígrafe ya puesto */ }
    else if (fig && $('.fig-num', fig)) lbCap.textContent = `${$('.fig-num', fig).textContent}. ${$('.fig-title', fig).textContent}`;
    else lbCap.textContent = img.alt;
    lb.hidden = false;
    D.body.classList.add('locked');
    lbFrom = z;
    $('.lb-close', lb).focus({ preventScroll: true });
  });
  function closeLb() {
    if (lb.hidden) return;
    lb.hidden = true;
    D.body.classList.remove('locked');
    lbImg.removeAttribute('src');
    if (lbFrom) lbFrom.focus({ preventScroll: true });
  }
  lb.addEventListener('click', e => {
    if (e.target.closest('.lb-prev')) { stepGal(-1); return; }
    if (e.target.closest('.lb-next')) { stepGal(1); return; }
    if (e.target === lb || e.target.closest('.lb-close')) closeLb();
  });
  D.addEventListener('keydown', e => {
    if (lb.hidden || !gal) return;
    if (e.key === 'ArrowLeft') stepGal(-1);
    if (e.key === 'ArrowRight') stepGal(1);
  });

  D.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    hidePop(true); closeLb(); closePanel();
  });

  /* ------------------------------------------------- visor de anexos */
  const axv = $('.axv');
  let axFrom = null;
  if (axv) {
    const axPages = $('.axv-pages', axv);
    D.addEventListener('click', e => {
      const a = e.target.closest('a.ax-f[data-ax]');
      if (!a) return;
      let pg = [];
      try { pg = JSON.parse(a.dataset.pg || '[]'); } catch (_) { pg = []; }
      if (!pg.length) return;               // sin páginas: el enlace se abre como siempre
      e.preventDefault();
      const n = a.dataset.ax;
      $('.axv-t', axv).textContent = `Anexo ${n}. ${a.dataset.t} · ${pg.length} ${pg.length === 1 ? 'página' : 'páginas'}`;
      $('.axv-pdf', axv).href = a.getAttribute('href');
      axPages.innerHTML = pg.map((s, i) => `<img src="ax${n}-${String(i + 1).padStart(2, '0')}.webp" width="${s[0]}" height="${s[1]}"` +
        `${s[0] > s[1] ? ' class="h"' : ''} loading="${i < 2 ? 'eager' : 'lazy'}" decoding="async" alt="Anexo ${n}, página ${i + 1}">`).join('');
      axPages.scrollTop = 0;
      axv.hidden = false;
      D.body.classList.add('locked');
      axFrom = a;
      $('.axv-x', axv).focus({ preventScroll: true });
    });
    const closeAx = () => {
      if (axv.hidden) return;
      axv.hidden = true; D.body.classList.remove('locked'); axPages.innerHTML = '';
      if (axFrom) axFrom.focus({ preventScroll: true });
    };
    $('.axv-x', axv).addEventListener('click', closeAx);
    D.addEventListener('keydown', e => { if (e.key === 'Escape') closeAx(); });
  }

  /* ------------------------------------- aviso: seguir donde dejaste */
  function offerResume() {
    if (location.hash.length > 1 || W.scrollY > 40) return;
    let s = null;
    try { s = JSON.parse(W.localStorage.getItem(POS_KEY) || 'null'); } catch (e) { s = null; }
    if (!s || !s.id || s.id === 'resumen') return;
    const el = D.getElementById(s.id);
    if (!el) return;
    const box = D.createElement('div');
    box.className = 'resume';
    box.setAttribute('role', 'status');
    box.innerHTML = '<p class="rs-p">Quedaste en <span class="rs-t"></span></p>' +
      '<button class="btn rs-go" type="button">Seguir leyendo</button>' +
      '<button class="rs-x" type="button" aria-label="Cerrar aviso">×</button>';
    box.querySelector('.rs-t').textContent = (s.num ? s.num + ' ' : '') + (s.t || '');
    D.body.appendChild(box);
    const onS = () => { if (W.scrollY > vh * 0.5) close(); };
    const close = () => { box.remove(); W.removeEventListener('scroll', onS); };
    box.querySelector('.rs-go').addEventListener('click', () => { close(); el.scrollIntoView(); });
    box.querySelector('.rs-x').addEventListener('click', close);
    W.addEventListener('scroll', onS, { passive: true });
  }

  /* ------------------------------------------------------------- inicio */
  const introOn = !!D.getElementById('intro') && !D.getElementById('intro').classList.contains('fin')
    && !W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  intro();
  retryImages();
  retAnim();
  const fontsReady = D.fonts && D.fonts.ready ? D.fonts.ready : Promise.resolve();
  fontsReady.then(() => {
    layout();
    if (location.hash.length > 1) {
      const t = D.getElementById(location.hash.slice(1));
      if (t) t.scrollIntoView();
    }
    D.documentElement.classList.add('ready');
    setTimeout(offerResume, introOn ? 2000 : 900);
  });

  let rT = 0, lastW = vw, lastH = vh;
  W.addEventListener('resize', () => {
    clearTimeout(rT);
    rT = setTimeout(() => {
      const w = W.innerWidth, h = W.innerHeight;
      const big = Math.abs(w - lastW) > 2 || Math.abs(h - lastH) > 90;
      if (big) {
        const a = anchorNow();
        lastW = w; lastH = h; vh = h;
        layout();
        restore(a);
        measure(); update();
      } else { measure(); update(); }
    }, 180);
  });
  W.addEventListener('scroll', () => { requestUpdate(); if (!pop.hidden) hidePop(true); }, { passive: true });
  W.addEventListener('load', () => { snapCards(); snapFlows(); measure(); update(); });
  /* las imágenes perezosas que cargan después cambian las alturas: se vuelve a medir
     para que la barra de arriba nombre bien el apartado */
  let imgT = 0;
  D.addEventListener('load', e => {
    if (e.target && e.target.tagName === 'IMG') { clearTimeout(imgT); imgT = setTimeout(() => { measure(); update(); }, 150); }
  }, true);
})();
