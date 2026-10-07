// Sayfa düzenleyici: Notion benzeri bloklar. Markdown okur ve yazar (sayfalar/<id>.md), yazdıkça kaydeder.
// Bloklar: metin, başlık 1-3, madde, numaralı, yapılacak, alıntı, kod, ayraç. "/" menüsü, Markdown kısayolları,
// Enter böler, Backspace birleştirir, ⌘B/⌘I biçim, yapıştırılan çok satırlı Markdown bloklara dönüşür.
// Yazı arkadaşı (K-024): yazmayı bırakınca Codex notu okur; önerileri sağ kenarda kart, ilgili yer işaretli. Uygula, Konuş, Çiz, geç.
(function () {
  const TURLER = [
    { tur: 'p', ad: 'Metin', ipucu: 'Düz yazı', iz: 'Aa' },
    { tur: 'h1', ad: 'Başlık 1', ipucu: 'Büyük bölüm başlığı', iz: 'H1' },
    { tur: 'h2', ad: 'Başlık 2', ipucu: 'Orta başlık', iz: 'H2' },
    { tur: 'h3', ad: 'Başlık 3', ipucu: 'Küçük başlık', iz: 'H3' },
    { tur: 'ul', ad: 'Madde listesi', ipucu: '- ile de başlar', iz: '•' },
    { tur: 'ol', ad: 'Numaralı liste', ipucu: '1. ile de başlar', iz: '1.' },
    { tur: 'todo', ad: 'Yapılacak', ipucu: '[] ile de başlar', iz: '☐' },
    { tur: 'quote', ad: 'Alıntı', ipucu: '> ile de başlar', iz: '❝' },
    { tur: 'code', ad: 'Kod', ipucu: '``` ile de başlar', iz: '<>' },
    { tur: 'hr', ad: 'Ayraç', ipucu: '--- ile de başlar', iz: '—' },
  ];
  // Menü araması Türkçe harfleri katlar ("bas" Başlık'ı bulur) ve İngilizce adları da tanır
  const ESAD = { p: 'text paragraf duz', h1: 'heading h1 baslik', h2: 'heading h2 baslik', h3: 'heading h3 baslik', ul: 'bullet list madde', ol: 'numbered list sira',
    todo: 'todo checkbox gorev yapilacak', quote: 'quote alinti', code: 'code kod', hr: 'divider ayrac cizgi' };
  const katla = (s) => String(s).toLocaleLowerCase('tr').replace(/[çğıöşüâîû]/g, (c) => 'cgiosuaiu'['çğıöşüâîû'.indexOf(c)]);
  const KISAYOL = [['### ', 'h3'], ['## ', 'h2'], ['# ', 'h1'], ['- ', 'ul'], ['* ', 'ul'], ['1. ', 'ol'], ['[] ', 'todo'], ['[ ] ', 'todo'], ['> ', 'quote']];
  const LISTE = new Set(['ul', 'ol', 'todo']);
  const kacis = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Markdown satır içi <-> HTML
  function satirIciHtml(md) {
    return kacis(md).replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*\w])\*([^*\s][^*\n]*?)\*/g, '$1<i>$2</i>').replace(/~~([^~\n]+)~~/g, '<s>$1</s>')
      .replace(/\[([^\]\n]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\[([^\]\n]+)\]\((\/ham\/[^)\s]+)\)/g, '<a class="sy-dosya" href="$2" target="_blank" rel="noopener">$1</a>')  // nota bırakılan dosya
      .replace(/\[([^\]\n]+)\]\(((?:\.\.?\/|\/)*panolar\/([A-Za-z0-9_.-]+\.dc\.html))\)/g, '<a href="$2" data-pano-git="$3">$1</a>')  // pano bağı: kabuk Çizim'de açar
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (t, on, url) => `${on}<a href="${url}" target="_blank" rel="noopener">${url}</a>`)  // çıplak link
      .replace(/\n/g, '<br>');
  }
  function htmlSatirIci(el) {
    let md = '';
    el.childNodes.forEach((n) => {
      if (n.nodeType === 3) { md += n.textContent.replace(/ /g, ' '); return; }
      if (n.nodeName === 'BR') { md += '\n'; return; }
      const ic = htmlSatirIci(n), ad = n.nodeName;
      if (!ic.trim() && ad !== 'DIV') { md += ic; return; }
      if (ad === 'B' || ad === 'STRONG') md += `**${ic}**`;
      else if (ad === 'I' || ad === 'EM') md += `*${ic}*`;
      else if (ad === 'CODE') md += '`' + ic + '`';
      else if (ad === 'S' || ad === 'STRIKE' || ad === 'DEL') md += `~~${ic}~~`;
      else if (ad === 'A') md += ic === n.getAttribute('href') ? ic : `[${ic}](${n.getAttribute('href')})`;
      else if (ad === 'DIV' || ad === 'P') md += (md && !md.endsWith('\n') ? '\n' : '') + ic;
      else md += ic;
    });
    return md;
  }

  // Markdown <-> bloklar
  function ayristir(md) {
    const bloklar = [], satirlar = String(md || '').replace(/\r/g, '').split('\n');
    let par = [];
    const parBitir = () => { if (par.length) { bloklar.push({ tur: 'p', metin: par.join('\n') }); par = []; } };
    for (let i = 0; i < satirlar.length; i++) {
      const s = satirlar[i];
      let m;
      if (/^```/.test(s)) {
        parBitir();
        const kod = [];
        for (i++; i < satirlar.length && !/^```/.test(satirlar[i]); i++) kod.push(satirlar[i]);
        bloklar.push({ tur: 'code', metin: kod.join('\n') });
      } else if (!s.trim()) parBitir();
      else if (/^(-{3,}|\*{3,})$/.test(s.trim())) { parBitir(); bloklar.push({ tur: 'hr', metin: '' }); }
      else if ((m = s.match(/^(#{1,3}) (.*)$/))) { parBitir(); bloklar.push({ tur: 'h' + m[1].length, metin: m[2] }); }
      else if ((m = s.match(/^[-*] \[( |x|X)\] ?(.*)$/))) { parBitir(); bloklar.push({ tur: 'todo', metin: m[2], tamam: m[1] !== ' ' }); }
      else if ((m = s.match(/^[-*] (.*)$/))) { parBitir(); bloklar.push({ tur: 'ul', metin: m[1] }); }
      else if ((m = s.match(/^\d+[.)] (.*)$/))) { parBitir(); bloklar.push({ tur: 'ol', metin: m[1] }); }
      else if ((m = s.match(/^> ?(.*)$/))) { parBitir(); bloklar.push({ tur: 'quote', metin: m[1] }); }
      else par.push(s);
    }
    parBitir();
    return bloklar.length ? bloklar : [{ tur: 'p', metin: '' }];
  }
  function mdYaz(bloklar) {
    const parca = [];
    let onceki = null, no = 0;
    for (const b of bloklar) {
      const bitisik = onceki === b.tur && (LISTE.has(b.tur) || b.tur === 'quote');  // aynı türden liste ve alıntı satırları bitişik
      no = b.tur === 'ol' ? (onceki === 'ol' ? no + 1 : 1) : 0;
      const satir = { h1: '# ', h2: '## ', h3: '### ', ul: '- ', quote: '> ' }[b.tur];
      const s = b.tur === 'ol' ? `${no}. ${b.metin}` : b.tur === 'todo' ? `- [${b.tamam ? 'x' : ' '}] ${b.metin}`
        : b.tur === 'code' ? '```\n' + b.metin + '\n```' : b.tur === 'hr' ? '---' : (satir || '') + b.metin;
      if (onceki) parca.push(bitisik ? '\n' : '\n\n');
      parca.push(s);
      onceki = b.tur;
    }
    return parca.join('').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  // İmleç yardımcıları
  const secim = () => getSelection();
  function imlecBasta(el) {
    const s = secim();
    if (!s.rangeCount || !s.isCollapsed) return false;
    const r = document.createRange();
    r.selectNodeContents(el); r.setEnd(s.getRangeAt(0).startContainer, s.getRangeAt(0).startOffset);
    return r.toString().length === 0;
  }
  function imlecRect() {
    const s = secim();
    if (!s.rangeCount) return null;
    const r = s.getRangeAt(0).cloneRange();
    const rects = r.getClientRects();
    if (rects.length) return rects[0];
    const g = document.createElement('span'); g.textContent = '​'; r.insertNode(g);
    const k = g.getBoundingClientRect(); g.remove();
    return k;
  }
  // İmleçten önceki metin (blok başından) ve imlecin hemen önündeki n karakteri silme: "/" menüsü imlecin olduğu yerde çalışır
  function imlecOncesi(el) {
    const s = secim();
    if (!s.rangeCount) return '';
    const r = document.createRange();
    r.selectNodeContents(el); r.setEnd(s.getRangeAt(0).endContainer, s.getRangeAt(0).endOffset);
    return r.toString();
  }
  function onundekiniSil(n) {
    const s = secim();
    if (!s.rangeCount) return false;
    const r = s.getRangeAt(0), d = r.endContainer;
    if (d.nodeType !== 3 || r.endOffset < n) return false;
    const sil = document.createRange();
    sil.setStart(d, r.endOffset - n); sil.setEnd(d, r.endOffset); sil.deleteContents();
    return true;
  }
  function odakla(el, nerede) {
    el.focus();
    const r = document.createRange();
    r.selectNodeContents(el); r.collapse(nerede !== 'son' ? true : false);
    if (nerede === 'son') r.collapse(false);
    const s = secim(); s.removeAllRanges(); s.addRange(r);
  }
  function sonrasiniKes(el) {
    // İmleçten bloğun sonuna kadar olan içeriği keser, HTML olarak döndürür
    const s = secim();
    if (!s.rangeCount) return '';
    const r = s.getRangeAt(0).cloneRange();
    r.setEndAfter(el.lastChild || el);
    const tasi = document.createElement('div'); tasi.appendChild(r.extractContents());
    return tasi.innerHTML;
  }

  // Önerinin alıntısını blokta bulur: metin düğümlerini dolaşıp bir Range kurar (biçimli metinde de çalışır)
  const alintiSade = (a) => String(a || '').split('\n')[0].replace(/^(#{1,3} |[-*] (\[[ xX]\] )?|\d+[.)] |> )/, '').replace(/\*\*|`/g, '').trim();
  function aralikBul(el, aranan) {
    const yuruyen = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), dugumler = [];
    let metin = '';
    for (let n = yuruyen.nextNode(); n; n = yuruyen.nextNode()) { dugumler.push([n, metin.length]); metin += n.textContent; }
    const i = metin.replace(/\u00a0/g, ' ').indexOf(aranan);
    if (i < 0 || !aranan) return null;
    const yer = (k, son) => { for (let d = dugumler.length - 1; d >= 0; d--) if (dugumler[d][1] < k || (!son && dugumler[d][1] === k) || d === 0) return [dugumler[d][0], k - dugumler[d][1]]; };
    const r = document.createRange();
    r.setStart(...yer(i, false)); r.setEnd(...yer(i + aranan.length, true));
    return r;
  }
  const fark = (a, b) => {
    let i = 0, j = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
    return Math.max(a.length, b.length) - i - j;
  };
  const ONERI_AD = { degistir: 'Düzelt', ekle: 'Ekle', soru: 'Soru', ciz: 'Çiz' };
  // Boş şablonlar (K-025, K-030): "/" menüsünde; Defter'e imlecin olduğu yere tarihli bir başlıkla iskeleti koyar
  const bugun = () => new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  // Satır dili: '' boş paragraf, '[]' boş yapılacak, '-' boş madde, gerisi Markdown satırı
  const SABLONLAR = [
    { ad: 'Günlük', iz: '☀', baslik: () => 'Günlük · ' + bugun(), satirlar: ['### Bugün', '[]', '### Aklımdakiler', '', '### Yarın', '[]'] },
    { ad: 'Toplantı', iz: '◷', baslik: () => 'Toplantı · ' + bugun(), satirlar: ['**Kimler:** ', '### Gündem', '-', '### Kararlar', '-', '### Yapılacaklar', '[]'] },
    { ad: 'Görüşme', iz: '☏', baslik: () => 'Görüşme · ' + bugun(), satirlar: ['**Kiminle:** ', '### Derdi ne', '', '### Şimdiye kadar ne denedi', '', '### Ne istiyor', '', '### Sonraki adım', '[]'] },
    { ad: 'Fikir', iz: '✦', baslik: () => 'Fikir', satirlar: ['', '### Neden önemli', '', '### Nasıl denerim', '[]'] },
    { ad: 'Yapılacaklar', iz: '☐', baslik: () => 'Yapılacaklar', satirlar: ['[]'] },
  ].map((t, i) => ({ ...t, sablon: i, ipucu: 'Şablon', ara: 'sablon template' }));
  const sablonBloklari = (t) => ['## ' + t.baslik(), ...t.satirlar].map((x) => (x === '' ? { tur: 'p', metin: '' } : x === '[]' ? { tur: 'todo', metin: '' } : x === '-' ? { tur: 'ul', metin: '' } : ayristir(x)[0]));

  function ac(kap, { baslik = '', govde = '', kaydet, durum, oneri, eylemler = [], ai = null }) {
    kap.innerHTML = `<div class="sy"><div class="sy-baslik" contenteditable="true" data-ph="Başlıksız" spellcheck="true"></div>
      <div class="sy-bloklar"></div></div>
      <div class="sy-menu" hidden></div>`;
    const kok = kap.querySelector('.sy'), alan = kap.querySelector('.sy-bloklar'), baslikEl = kap.querySelector('.sy-baslik'), menu = kap.querySelector('.sy-menu');
    baslikEl.textContent = baslik;
    let saat = null, sonKayit = null, menuDurum = null;

    function blokYap(b) {
      const el = document.createElement('div');
      el.className = 'sy-blok'; el.dataset.tur = b.tur;
      el.innerHTML = `<div class="sy-tutamak"><button type="button" class="sy-arti" title="Altına blok ekle" tabindex="-1">+</button><button type="button" class="sy-tut" title="Blok menüsü" tabindex="-1">⋮⋮</button></div>`
        + (b.tur === 'todo' ? `<input type="checkbox" class="sy-kutu"${b.tamam ? ' checked' : ''} tabindex="-1">` : '')
        + (b.tur === 'hr' ? '<hr>' : `<div class="sy-metin" contenteditable="true" spellcheck="${b.tur !== 'code'}"></div>`);
      const m = el.querySelector('.sy-metin');
      if (m) { if (b.tur === 'code') m.textContent = b.metin; else m.innerHTML = satirIciHtml(b.metin); }
      if (b.tamam) el.classList.add('tamam');
      return el;
    }
    const metinEl = (blok) => blok.querySelector('.sy-metin');
    const blokOku = (blok) => {
      const tur = blok.dataset.tur, m = metinEl(blok);
      return { tur, metin: tur === 'hr' ? '' : tur === 'code' ? m.textContent : htmlSatirIci(m).replace(/\n+$/, ''), tamam: !!blok.querySelector('.sy-kutu')?.checked };
    };
    const bloklar = () => [...alan.children].map(blokOku);
    function numaralandir() {
      let no = 0, onceki = null;
      for (const b of alan.children) { no = b.dataset.tur === 'ol' ? (onceki === 'ol' ? no + 1 : 1) : 0; if (no) b.dataset.no = no + '.'; onceki = b.dataset.tur; }
    }
    function planla() {
      numaralandir();
      clearTimeout(saat);
      if (durum) durum('Yazılıyor…');
      saat = setTimeout(simdiKaydet, 600);
    }
    async function simdiKaydet() {
      clearTimeout(saat); saat = null;
      const veri = { title: baslikEl.textContent.replace(/\s+/g, ' ').trim(), govde: mdYaz(bloklar()) };
      const imza = JSON.stringify(veri);
      if (imza === sonKayit) { if (durum) durum('Kaydedildi'); return; }
      try { await kaydet(veri); sonKayit = imza; if (durum) durum('Kaydedildi'); oneriPlanla(); } catch (e) { if (durum) durum('Kaydedilemedi: ' + e.message); }
    }
    function turDegis(blok, tur, metinHtml) {
      const eski = blokOku(blok);
      const yeni = blokYap({ tur, metin: tur === 'code' ? eski.metin : '', tamam: false });
      if (tur !== 'hr' && tur !== 'code') metinEl(yeni).innerHTML = metinHtml ?? metinEl(blok)?.innerHTML ?? '';
      blok.replaceWith(yeni);
      if (tur === 'hr') { const p = ekle(yeni, { tur: 'p', metin: '' }); odakla(metinEl(p)); }
      else odakla(metinEl(yeni), 'son');
      planla();
      return yeni;
    }
    function ekle(sonra, b) {
      const el = blokYap(b);
      sonra ? sonra.after(el) : alan.appendChild(el);
      return el;
    }

    // Yükle
    for (const b of ayristir(govde)) alan.appendChild(blokYap(b));
    numaralandir();
    sonKayit = JSON.stringify({ title: baslik, govde: mdYaz(bloklar()) });

    // "/" menüsü
    function menuAc(blok, sorgu = '') {
      menuDurum = { blok, sorgu, sec: 0 };
      menu.dataset.mod = '';
      menuCiz();
      const r = imlecRect() || blok.getBoundingClientRect(), k = kap.getBoundingClientRect();
      menu.style.left = Math.max(0, r.left - k.left) + 'px';
      menu.style.top = (r.bottom - k.top + kap.scrollTop + 6) + 'px';
      menu.hidden = false;
    }
    function menuSecenekleri() {
      const q = katla(menuDurum?.sorgu || '');
      return [...TURLER.filter((t) => !q || katla(t.ad + ' ' + ESAD[t.tur]).includes(q)),
        ...SABLONLAR.filter((t) => q && katla(t.ad + ' ' + t.ara).includes(q)),
        ...eylemler.map((x, i) => ({ ...x, eylem: i })).filter((x) => !q || katla(x.ad + ' ' + (x.ara || '')).includes(q))];
    }
    function menuCiz() {
      const s = menuSecenekleri();
      if (!s.length) { menuKapat(); return; }
      menuDurum.sec = Math.min(menuDurum.sec, s.length - 1);
      const oge = (t, i) => `<button type="button" class="sy-menu-oge" ${t.eylem !== undefined ? `data-eylem-no="${t.eylem}"` : t.sablon !== undefined ? `data-sablon-no="${t.sablon}"` : `data-tur="${t.tur}"`} aria-selected="${i === menuDurum.sec}"><span class="sy-iz">${kacis(t.iz)}</span><span><b>${t.ad}</b><small>${t.ipucu}</small></span></button>`;
      const bloklar = s.filter((t) => t.tur), sablonlar = s.filter((t) => t.sablon !== undefined), codex = s.filter((t) => t.eylem !== undefined);
      menu.innerHTML = (bloklar.length ? `<div class="sy-menu-bas">Bloklar</div>` + bloklar.map((t) => oge(t, s.indexOf(t))).join('') : '')
        + (sablonlar.length ? `<div class="sy-menu-bas">Şablonlar</div>` + sablonlar.map((t) => oge(t, s.indexOf(t))).join('') : '')
        + (codex.length ? `<div class="sy-menu-bas">Codex</div>` + codex.map((t) => oge(t, s.indexOf(t))).join('') : '');
    }
    function menuKapat() { menu.hidden = true; menuDurum = null; }
    function menuSec(tur, eylemNo, sablonNo) {
      const { blok, sorgu } = menuDurum;
      if (sablonNo !== undefined) {  // Şablon: "/sorgu"yu sil, iskeleti bu bloğun yerine (boşsa) ya da altına koy
        menuKapat();
        const m = metinEl(blok);
        if (!onundekiniSil(1 + sorgu.length)) m.innerHTML = satirIciHtml(htmlSatirIci(m).replace('/' + sorgu, ''));
        return sablonKoy(SABLONLAR[sablonNo], blok, !m.textContent.trim());
      }
      if (eylemNo !== undefined) {  // Codex eylemi: "/sorgu"yu sil, eylemi çalıştır
        menuKapat();
        if (!onundekiniSil(1 + sorgu.length)) metinEl(blok).innerHTML = satirIciHtml(htmlSatirIci(metinEl(blok)).replace('/' + sorgu, ''));
        planla(); simdiKaydet().then(() => eylemler[eylemNo].calistir(blok));
        return;
      }
      menuKapat();
      const m = metinEl(blok);
      // "/sorgu" imlecin hemen önünde: sil; blok boş kaldıysa bloğun kendisi dönüşür, doluysa altına yeni blok
      if (!onundekiniSil(1 + sorgu.length)) m.innerHTML = satirIciHtml(htmlSatirIci(m).replace('/' + sorgu, ''));
      if (!m.textContent.trim()) { m.innerHTML = ''; return turDegis(blok, tur, ''); }
      const yeni = ekle(blok, { tur, metin: '' });
      if (tur === 'hr') { const p = ekle(yeni, { tur: 'p', metin: '' }); odakla(metinEl(p)); } else odakla(metinEl(yeni));
      planla();
    }
    menu.addEventListener('mousedown', (e) => { e.preventDefault(); const x = e.target.closest('[data-eylem-no]'); if (x && menuDurum) return void menuSec(null, Number(x.dataset.eylemNo)); const sb = e.target.closest('[data-sablon-no]'); if (sb && menuDurum) return void menuSec(null, undefined, Number(sb.dataset.sablonNo)); const o = e.target.closest('[data-tur]'); if (o && menuDurum) menuSec(o.dataset.tur); else if (o && menu.dataset.mod === 'donustur') { const b = tutulan; menuKapat(); turDegis(b, o.dataset.tur); } else if (e.target.closest('[data-eylem]')) blokEylem(e.target.closest('[data-eylem]').dataset.eylem); });

    // Blok tutamağı: + altına blok, ⋮⋮ menü (dönüştür, taşı, sil)
    let tutulan = null;
    function blokEylem(eylem) {
      const b = tutulan; menuKapat(); menu.dataset.mod = '';
      if (!b) return;
      if (eylem === 'sil') { const komsu = b.previousElementSibling || b.nextElementSibling; b.remove(); if (!alan.children.length) ekle(null, { tur: 'p', metin: '' }); const h = komsu && metinEl(komsu); if (h) odakla(h, 'son'); }
      else if (eylem === 'yukari' && b.previousElementSibling) b.previousElementSibling.before(b);
      else if (eylem === 'asagi' && b.nextElementSibling) b.nextElementSibling.after(b);
      else if (eylem === 'cogalt') b.after(blokYap(blokOku(b)));
      planla();
    }
    alan.addEventListener('mousedown', (e) => {
      const arti = e.target.closest('.sy-arti'), tut = e.target.closest('.sy-tut');
      if (!arti && !tut) return;
      e.preventDefault();
      const blok = e.target.closest('.sy-blok');
      if (arti) { const yeni = ekle(blok, { tur: 'p', metin: '' }); const m = metinEl(yeni); odakla(m); m.textContent = '/'; odakla(m, 'son'); menuAc(yeni, ''); return; }
      surukleBasla(e, blok, tut);
    });
    // ⋮⋮ tutamağı, Notion gibi: sürüklersen blok taşınır (mavi çizgi yeri gösterir), tıklarsan blok menüsü açılır
    const cizgi = document.createElement('div');
    cizgi.className = 'sy-birak'; cizgi.hidden = true;
    kap.appendChild(cizgi);
    function surukleBasla(e, blok, tut) {
      const x0 = e.clientX, y0 = e.clientY;
      let hayalet = null, hedef = undefined, kaydir = 0;
      const hedefBul = (y) => {
        for (const b of alan.children) { const r = b.getBoundingClientRect(); if (y < r.top + r.height / 2) return b; }
        return null;  // en sona
      };
      const cizgiKoy = () => {
        const k = kap.getBoundingClientRect(), a = alan.getBoundingClientRect();
        const son = alan.lastElementChild, ref = hedef ? hedef.getBoundingClientRect().top - 1 : son.getBoundingClientRect().bottom + 1;
        cizgi.style.top = (ref - k.top + kap.scrollTop) + 'px';
        cizgi.style.left = (a.left - k.left) + 'px'; cizgi.style.width = a.width + 'px';
        cizgi.hidden = hedef === blok || hedef === blok.nextElementSibling;  // yerinden oynamıyor
      };
      const hareket = (ev) => {
        if (!hayalet) {
          if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
          hayalet = blok.cloneNode(true);
          hayalet.className = 'sy-blok sy-hayalet';
          hayalet.style.width = blok.getBoundingClientRect().width + 'px';
          document.body.appendChild(hayalet);
          blok.classList.add('suruklenen'); kok.classList.add('surukleniyor');
          menuKapat();
        }
        hayalet.style.transform = `translate(${ev.clientX + 14}px, ${ev.clientY + 10}px)`;
        hedef = hedefBul(ev.clientY);
        cizgiKoy();
        // Kenara yaklaşınca kaydır
        const k = kap.getBoundingClientRect();
        cancelAnimationFrame(kaydir);
        const hiz = ev.clientY < k.top + 60 ? -12 : ev.clientY > k.bottom - 60 ? 12 : 0;
        if (hiz) { const adim = () => { kap.scrollTop += hiz; cizgiKoy(); kaydir = requestAnimationFrame(adim); }; kaydir = requestAnimationFrame(adim); }
      };
      const birak = () => {
        document.removeEventListener('pointermove', hareket); document.removeEventListener('pointerup', birak);
        cancelAnimationFrame(kaydir);
        if (!hayalet) { blokMenusu(blok, tut); return; }
        hayalet.remove(); cizgi.hidden = true;
        blok.classList.remove('suruklenen'); kok.classList.remove('surukleniyor');
        if (hedef !== undefined && hedef !== blok && hedef !== blok.nextElementSibling) {
          alan.insertBefore(blok, hedef);
          numaralandir(); planla();
          if (oneriler.length) yerlestir();
        }
      };
      document.addEventListener('pointermove', hareket); document.addEventListener('pointerup', birak);
    }
    function blokMenusu(blok, tut) {
      tutulan = blok; menuDurum = null; menu.dataset.mod = 'donustur';
      menu.innerHTML = `<div class="sy-menu-bas">Blok</div><button type="button" class="sy-menu-oge" data-eylem="cogalt"><span class="sy-iz">⧉</span><span><b>Çoğalt</b></span></button>
        <button type="button" class="sy-menu-oge" data-eylem="yukari"><span class="sy-iz">↑</span><span><b>Yukarı taşı</b></span></button><button type="button" class="sy-menu-oge" data-eylem="asagi"><span class="sy-iz">↓</span><span><b>Aşağı taşı</b></span></button>
        <button type="button" class="sy-menu-oge sy-sil" data-eylem="sil"><span class="sy-iz">×</span><span><b>Sil</b></span></button><div class="sy-menu-bas">Dönüştür</div>`
        + TURLER.map((t) => `<button type="button" class="sy-menu-oge" data-tur="${t.tur}"><span class="sy-iz">${kacis(t.iz)}</span><span><b>${t.ad}</b></span></button>`).join('');
      const r = tut.getBoundingClientRect(), k = kap.getBoundingClientRect();
      menu.style.left = (r.left - k.left) + 'px'; menu.style.top = (r.bottom - k.top + kap.scrollTop + 4) + 'px'; menu.hidden = false;
    }
    alan.addEventListener('change', (e) => { if (e.target.classList.contains('sy-kutu')) { e.target.closest('.sy-blok').classList.toggle('tamam', e.target.checked); planla(); } });
    const disTik = (e) => { if (!menu.hidden && !menu.contains(e.target)) { menuKapat(); menu.dataset.mod = ''; } };
    document.addEventListener('mousedown', disTik, true);

    // Metin seçince üstte biçim çubuğu: kalın, italik, üstü çizili, satır içi kod
    const cubuk = document.createElement('div');
    cubuk.className = 'sy-bicim'; cubuk.hidden = true;
    cubuk.innerHTML = '<button type="button" data-b="bold" title="Kalın (⌘B)"><b>B</b></button><button type="button" data-b="italic" title="İtalik (⌘I)"><i>i</i></button>'
      + '<button type="button" data-b="strikeThrough" title="Üstü çizili"><s>S</s></button><button type="button" data-b="kod" title="Satır içi kod">&lt;/&gt;</button>'
      + '<button type="button" data-b="link" title="Link (⌘⇧K)"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M7 9a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-.8.8M9 7a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l.8-.8"/></svg></button><span class="sy-bicim-sayi"></span>'
      + (ai ? '<span class="sy-bicim-ayrac"></span><button type="button" data-b="codex" class="sy-bicim-codex" title="Seçileni Codex\'e ver">' + (typeof kivSvg === 'function' ? kivSvg('normal', 16) : '✦ Codex') + '</button>' : '');
    kap.appendChild(cubuk);
    const cubukMenu = document.createElement('div');
    cubukMenu.className = 'sy-bicim-menu'; cubukMenu.hidden = true;
    cubukMenu.innerHTML = '<button type="button" data-ai-eylem="toparla"><b>Toparla</b><small>Düzenler, yazım hatasını düzeltir, sesini korur</small></button>'
      + '<button type="button" data-ai-eylem="gecmis"><b>Geçmişle değerlendir</b><small>Önceki notların ve kararlarınla karşılaştırır</small></button>'
      + '<input class="sy-ai-gir" placeholder="Ya da söyle: maddele, kısalt, e-postaya çevir…">';
    kap.appendChild(cubukMenu);
    let secilenBloklar = [];
    const ogeOf = (n) => n && (n.nodeType === 1 ? n : n.parentElement);
    // Seçimin dokunduğu bloklar (bir ya da birkaç); Codex kutusu bunlar üstünde çalışır
    function secimBloklari() {
      const s = secim();
      if (!s.rangeCount) return [];
      const a = ogeOf(s.anchorNode)?.closest('.sy-blok'), b = ogeOf(s.focusNode)?.closest('.sy-blok');
      if (!a || !b || !alan.contains(a) || !alan.contains(b)) return [];
      const hepsi = [...alan.children], i = hepsi.indexOf(a), j = hepsi.indexOf(b);
      return hepsi.slice(Math.min(i, j), Math.max(i, j) + 1);
    }
    function secimDinle() {
      if (seciliBloklar.size) return void blokCubuk();
      const s = secim(), m = s.rangeCount && !s.isCollapsed && ogeOf(s.anchorNode)?.closest('.sy-metin');
      const tek = m && alan.contains(m) && m.closest('.sy-blok').dataset.tur !== 'code' && ogeOf(s.focusNode)?.closest('.sy-metin') === m;
      const cok = !tek && ai && s.rangeCount && !s.isCollapsed && secimBloklari().length > 1;
      if (!tek && !cok) { if (!cubukMenu.contains(document.activeElement)) { cubuk.hidden = true; cubukMenu.hidden = true; } return; }
      cubuk.classList.toggle('cok', !!cok);
      const r = s.getRangeAt(0).getBoundingClientRect(), k = kap.getBoundingClientRect();
      cubuk.style.left = (r.left - k.left + r.width / 2) + 'px';
      cubuk.style.top = (r.top - k.top + kap.scrollTop - 42) + 'px';
      cubuk.hidden = false;
    }
    document.addEventListener('selectionchange', secimDinle);

    // Link: seçili yazıya bağ (çubukta link düğmesi ya da ⌘⇧K); seçiliyken URL yapıştırınca da link olur
    const linkKutu = document.createElement('div');
    linkKutu.className = 'sy-link'; linkKutu.hidden = true;
    linkKutu.innerHTML = '<input class="sy-link-gir" placeholder="Link yapıştır ya da yaz, Enter" spellcheck="false">';
    kap.appendChild(linkKutu);
    let linkAralik = null;
    const urlYap = (u) => (/^[a-z][\w+.-]*:/i.test(u) || u.startsWith('/') || u.startsWith('#') ? u : 'https://' + u);
    function linkAc() {
      const s = secim();
      if (!s.rangeCount || s.isCollapsed) return;
      linkAralik = s.getRangeAt(0).cloneRange();
      const var_ = ogeOf(s.anchorNode)?.closest('a');
      linkKutu.style.left = cubuk.style.left; linkKutu.style.top = (parseFloat(cubuk.style.top) + 40) + 'px';
      linkKutu.hidden = false; cubuk.hidden = true;
      const g = linkKutu.querySelector('input'); g.value = var_ ? var_.getAttribute('href') : ''; g.focus(); g.select();
    }
    function linkKoy(url) {
      linkKutu.hidden = true;
      if (!linkAralik) return;
      const s = secim(); s.removeAllRanges(); s.addRange(linkAralik);
      if (url) document.execCommand('createLink', false, urlYap(url)); else document.execCommand('unlink');
      linkAralik = null; planla();
    }
    linkKutu.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); linkKoy(e.target.value.trim()); }
      if (e.key === 'Escape') { linkKutu.hidden = true; linkAralik = null; }
    });
    linkKutu.addEventListener('focusout', () => setTimeout(() => { if (!linkKutu.contains(document.activeElement)) linkKutu.hidden = true; }, 120));

    // Blok seçimi (Notion gibi): yazarken fare başka bloğa geçince, sayfanın boş kenarından sürükleyince ya da Shift+tıkla;
    // seçili bloklar Sil, ⌘C, ⌘X, Kıvılcım ile çalışır, Esc bırakır. ⌘A iki kez: önce blok, sonra bütün sayfa.
    const seciliBloklar = new Set();
    let surukle = null, sonOdak = null;
    function blokSec(liste) {
      for (const x of alan.querySelectorAll('.sy-blok.secili')) x.classList.remove('secili');
      seciliBloklar.clear();
      for (const x of liste) { x.classList.add('secili'); seciliBloklar.add(x); }
      if (liste.length) { secim().removeAllRanges(); blokCubuk(); } else { cubuk.hidden = true; cubuk.classList.remove('cok'); }
    }
    const blokAralik = (a, b) => { const h = [...alan.children], i = h.indexOf(a), j = h.indexOf(b); return i < 0 || j < 0 ? [] : h.slice(Math.min(i, j), Math.max(i, j) + 1); };
    function blokYde(y) {
      let en = null, fark = Infinity;
      for (const x of alan.children) { const r = x.getBoundingClientRect(); const f = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0; if (f < fark) { fark = f; en = x; } }
      return en;
    }
    function blokCubuk() {
      const ilk = [...alan.children].find((x) => seciliBloklar.has(x));
      if (!ilk) return;
      const r = ilk.getBoundingClientRect(), k = kap.getBoundingClientRect();
      cubuk.classList.add('cok'); cubuk.querySelector('.sy-bicim-sayi').textContent = seciliBloklar.size + ' blok';
      cubuk.style.left = (r.left - k.left + Math.min(r.width, 520) / 2) + 'px'; cubuk.style.top = (r.top - k.top + kap.scrollTop - 42) + 'px';
      cubuk.hidden = false;
    }
    alan.addEventListener('focusin', (e) => { const b = e.target.closest('.sy-blok'); if (b) sonOdak = b; });
    const sayfaEl = kap.querySelector('.sy');
    sayfaEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target.closest('button, input, a, .sy-baslik, .sy-oneriler, .sy-bicim, .sy-bicim-menu, .sy-link')) return;
      const blok = e.target.closest('.sy-blok');
      if (e.shiftKey && (seciliBloklar.size || sonOdak) && blok) { e.preventDefault(); blokSec(blokAralik(seciliBloklar.size ? [...alan.children].find((x) => seciliBloklar.has(x)) : sonOdak, blok)); return; }
      if (seciliBloklar.size) blokSec([]);
      const kenardan = !e.target.closest('.sy-metin');
      if (kenardan && !alan.children.length) return;
      surukle = { bas: blok || blokYde(e.clientY), kenardan, oldu: false };
      if (kenardan) e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!surukle || !(e.buttons & 1)) return;
      const simdi = blokYde(e.clientY);
      if (!simdi || (!surukle.oldu && !surukle.kenardan && simdi === surukle.bas)) return;
      surukle.oldu = true; alan.classList.add('blok-secimde');
      blokSec(blokAralik(surukle.bas, simdi));
    });
    document.addEventListener('mouseup', () => { if (surukle) { alan.classList.remove('blok-secimde'); surukle = null; } });
    document.addEventListener('keydown', (e) => {
      if (!kap.isConnected) return;
      const icinde = kap.contains(document.activeElement) || seciliBloklar.size;
      if (!icinde) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); e.stopImmediatePropagation(); return void linkAc(); }
      if (mod && (e.key === 'a' || e.key === 'A') && !seciliBloklar.size) {  // ikinci ⌘A bütün bloklar
        const s = secim(), m = ogeOf(s.anchorNode)?.closest('.sy-metin');
        if (m && alan.contains(m) && s.toString().length && s.toString().length >= m.textContent.length) { e.preventDefault(); blokSec([...alan.children]); }
        return;
      }
      if (!seciliBloklar.size) return;
      const liste = [...alan.children].filter((x) => seciliBloklar.has(x));
      if (e.key === 'Escape') { e.preventDefault(); blokSec([]); return; }
      if (mod && (e.key === 'c' || e.key === 'C' || e.key === 'x' || e.key === 'X')) {
        e.preventDefault(); navigator.clipboard?.writeText(mdYaz(liste.map(blokOku))).catch(() => {});
        if (e.key.toLowerCase() === 'c') return;
      } else if (e.key !== 'Backspace' && e.key !== 'Delete') { if (!['Shift', 'Meta', 'Control', 'Alt'].includes(e.key)) blokSec([]); return; }
      e.preventDefault();
      const sonra = liste[liste.length - 1].nextElementSibling, once = liste[0].previousElementSibling;
      blokSec([]); liste.forEach((x) => x.remove());
      if (!alan.children.length) ekle(null, { tur: 'p', metin: '' });
      const hedef = (sonra && alan.contains(sonra) ? sonra : once) || alan.firstElementChild;
      if (hedef && metinEl(hedef)) odakla(metinEl(hedef));
      planla();
    }, true);
    cubuk.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const b = e.target.closest('[data-b]');
      if (!b) return;
      if (b.dataset.b === 'codex') {
        secilenBloklar = seciliBloklar.size ? [...alan.children].filter((x) => seciliBloklar.has(x)) : secimBloklari();
        cubukMenu.style.left = cubuk.style.left; cubukMenu.style.top = (parseFloat(cubuk.style.top) + 40) + 'px';
        cubukMenu.hidden = !cubukMenu.hidden;
        return;
      }
      if (b.dataset.b === 'link') return void linkAc();
      if (b.dataset.b === 'kod') document.execCommand('insertHTML', false, '<code>' + kacis(secim().toString()) + '</code>');
      else document.execCommand(b.dataset.b);
      planla(); secimDinle();
    });

    // Başlık: Enter ilk bloğa iner
    // Başlıkta Enter, Notion gibi: ilk blok doluysa en üste boş satır açar; aşağı ok ilk bloğa iner
    baslikEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const ilk = alan.firstElementChild;
      if (e.key === 'Enter' && (!ilk || ilk.dataset.tur !== 'p' || metinEl(ilk).textContent.trim())) {
        const yeni = blokYap({ tur: 'p', metin: '' });
        alan.prepend(yeni); odakla(metinEl(yeni)); planla(); return;
      }
      const m = alan.querySelector('.sy-metin');
      if (m) odakla(m);
    });
    baslikEl.addEventListener('input', planla);

    // Şablonu bloğun altına (yerine: boşsa) koyar, imleci ilk yazılacak yere götürür
    function sablonKoy(t, blok, yerine) {
      const yeni = sablonBloklari(t).map(blokYap);
      let son = blok;
      for (const el of yeni) { son.after(el); son = el; }
      if (yerine) blok.remove();
      if (!son.nextElementSibling) ekle(son, { tur: 'p', metin: '' });
      numaralandir(); planla();
      // İlk yazı yerine in: "Kimler:" gibi bir etiket satırı varsa onun sonuna, yoksa ilk boş bloğa
      const etiket = yeni.find((x) => x.dataset.tur === 'p' && /:\s*$/.test(metinEl(x)?.textContent || ''));
      const bos = yeni.find((x) => metinEl(x) && !metinEl(x).textContent.trim() && !/^h[1-3]$/.test(x.dataset.tur));
      if (etiket) odakla(metinEl(etiket), 'son'); else if (bos) odakla(metinEl(bos)); else odakla(metinEl(yeni[0]), 'son');
    }

    alan.addEventListener('keydown', (e) => {
      const m = e.target.closest('.sy-metin');
      if (!m) return;
      const blok = m.closest('.sy-blok'), tur = blok.dataset.tur;
      if (menuDurum && !menu.hidden) {
        const s = menuSecenekleri();
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); menuDurum.sec = (menuDurum.sec + (e.key === 'ArrowDown' ? 1 : -1) + s.length) % s.length; menuCiz(); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); const t = s[menuDurum.sec]; if (t) menuSec(t.tur, t.eylem, t.sablon); return; }
        if (e.key === 'Escape') { e.preventDefault(); menuKapat(); return; }
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'i')) { e.preventDefault(); document.execCommand(e.key === 'b' ? 'bold' : 'italic'); planla(); return; }
      if (e.key === 'Enter' && tur === 'code' && !e.shiftKey) { e.preventDefault(); document.execCommand('insertText', false, '\n'); return; }
      if (e.key === 'Enter' && e.shiftKey && tur !== 'code') { e.preventDefault(); document.execCommand('insertLineBreak'); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (LISTE.has(tur) && !m.textContent.trim()) { turDegis(blok, 'p', ''); return; }
        const sonrasi = tur === 'code' ? '' : sonrasiniKes(m);
        const yeniTur = LISTE.has(tur) ? tur : 'p';
        const yeni = ekle(blok, { tur: yeniTur, metin: '' });
        metinEl(yeni).innerHTML = sonrasi;
        odakla(metinEl(yeni));
        planla();
        return;
      }
      if (e.key === 'Backspace' && imlecBasta(m)) {
        if (tur !== 'p') { e.preventDefault(); turDegis(blok, 'p'); return; }
        const onceki = blok.previousElementSibling;
        if (!onceki) return;
        e.preventDefault();
        if (onceki.dataset.tur === 'hr') { onceki.remove(); planla(); return; }
        const om = metinEl(onceki);
        const birlesme = om.textContent.length;
        const html = m.innerHTML;
        odakla(om, 'son');
        if (html) document.execCommand('insertHTML', false, html);
        blok.remove();
        // İmleç birleşme noktasına
        if (birlesme >= 0) { /* insertHTML imleci eklenen metnin sonuna koyar; Notion'daki gibi yeterli */ }
        planla();
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const r = imlecRect(), er = m.getBoundingClientRect();
        if (!r) return;
        const yukari = e.key === 'ArrowUp';
        const sinirda = yukari ? r.top - er.top < 10 : er.bottom - r.bottom < 10;
        let hedef = yukari ? blok.previousElementSibling : blok.nextElementSibling;
        while (hedef && !metinEl(hedef)) hedef = yukari ? hedef.previousElementSibling : hedef.nextElementSibling;
        if (sinirda) { e.preventDefault(); if (hedef) odakla(metinEl(hedef), yukari ? 'son' : 'bas'); else if (yukari) odakla(baslikEl, 'son'); }
      }
    });

    alan.addEventListener('input', (e) => {
      const m = e.target.closest('.sy-metin');
      if (!m) return;
      if (m.innerHTML === '<br>') m.innerHTML = '';
      const blok = m.closest('.sy-blok'), yazi = m.textContent.replace(/ /g, ' ');
      // Markdown kısayolu: blok başında "# ", "- ", "[] " ...
      if (blok.dataset.tur === 'p') {
        if (yazi === '```') { m.innerHTML = ''; turDegis(blok, 'code', ''); return; }
        if (yazi === '---') { m.innerHTML = ''; turDegis(blok, 'hr', ''); return; }
        for (const [onek, tur] of KISAYOL) if (yazi.startsWith(onek)) {
          m.innerHTML = satirIciHtml(htmlSatirIci(m).replace(/\u00a0/g, ' ').slice(onek.length)); turDegis(blok, tur); return;
        }
      }
      // "/" menüsü: imlecin önünde "/sorgu" (satır başında ya da boşluktan sonra)
      const t = imlecOncesi(m).replace(/\u00a0/g, ' ').match(/(?:^|\s)\/([^\s/]{0,20})$/);
      if (t && blok.dataset.tur !== 'code') { if (menuDurum && menuDurum.blok === blok) { menuDurum.sorgu = t[1]; menuCiz(); } else menuAc(blok, t[1]); }
      else if (menuDurum) menuKapat();
      planla();
    });

    alan.addEventListener('paste', (e) => {
      const m = e.target.closest('.sy-metin');
      if (!m) return;
      e.preventDefault();
      const metin = (e.clipboardData || window.clipboardData).getData('text/plain');
      const blok = m.closest('.sy-blok');
      const sec = secim();
      if (/^https?:\/\/\S+$/.test(metin.trim()) && !sec.isCollapsed && blok.dataset.tur !== 'code') { document.execCommand('createLink', false, metin.trim()); planla(); return; }
      if (!metin.includes('\n') || blok.dataset.tur === 'code') { document.execCommand('insertText', false, metin); return; }
      let son = blok;
      const yeni = ayristir(metin);
      if (!m.textContent.trim() && blok.dataset.tur === 'p') { const ilk = blokYap(yeni.shift()); blok.replaceWith(ilk); son = ilk; }
      for (const b of yeni) son = ekle(son, b);
      const h = metinEl(son); if (h) odakla(h, 'son');
      planla();
    });

    // Yazı arkadaşı: kayıttan 3,5 sn sonra (yazmayı bırakınca), metin yeterince değiştiyse, en sık 20 sn'de bir Codex'e sorar
    const kenar = document.createElement('div');
    kenar.className = 'sy-oneriler';
    kap.appendChild(kenar);
    let oneriler = [], gecmis = [], oneriSaat = null, istekte = false, sonIstenen = '', sonIstek = 0, odakli = null;
    const oneriAcik = () => !!oneri && (!oneri.acik || oneri.acik());
    function oneriPlanla() {
      if (!oneriAcik()) return;
      clearTimeout(oneriSaat);
      oneriSaat = setTimeout(oneriIste, 3500);
    }
    // zorla: kullanıcı açıkça istedi (⋯ › "Bu nota baksın"); anahtar, fark ve bekleme sınırı sayılmaz. Öneri sayısını döner, not kısaysa null.
    async function oneriIste(zorla = false) {
      const metin = mdYaz(bloklar());
      if (istekte || !oneri) return 0;
      if (metin.replace(/\s/g, '').length < 40) return null;
      if (zorla !== true) {
        if (!oneriAcik() || fark(metin, sonIstenen) < 25) return 0;
        const kalan = 20000 - (Date.now() - sonIstek);
        if (kalan > 0) { oneriSaat = setTimeout(oneriIste, kalan); return 0; }
      }
      istekte = true; sonIstek = Date.now(); sonIstenen = metin;
      if (oneri.hal) oneri.hal('Codex okuyor…');
      try { await simdiKaydet(); oneriKoy(await oneri.iste(gecmis.slice(-30))); return oneriler.length; }
      catch { /* öneri yardımcıdır: hata yazıyı bozmasın; yeniden okutmak kullanıcının isteğiyle (K-074) */ sonIstenen = ''; return 0; }
      finally { istekte = false; if (oneri?.hal) oneri.hal(''); }
    }
    function oneriKoy(liste) {
      oneriler = [];
      for (const o of liste || []) {
        const aranan = alintiSade(o.alinti);
        for (const blok of alan.children) {
          const m = metinEl(blok), aralik = m && aralikBul(m, aranan);
          if (aralik) { oneriler.push({ ...o, aranan, blok, aralik }); break; }
        }
      }
      oneriCiz();
    }
    // Eklenecek Markdown'ın küçük önizlemesi: başlık kalın, liste imli
    const onizle = (md) => ayristir(md).map((b) => `<div class="oi oi-${b.tur}">${b.tur === 'todo' ? '☐ ' : b.tur === 'ul' ? '• ' : ''}${satirIciHtml(b.metin)}</div>`).join('');
    function kartYap(o, i) {
      const govdeHtml = o.tur === 'degistir' ? `<div class="sy-oneri-yeni">${satirIciHtml(o.yeni)}</div>`
        : o.tur === 'ekle' ? `<div class="sy-oneri-yeni sy-oneri-ek">${onizle(o.yeni)}</div>` : `<div class="sy-oneri-soru">${satirIciHtml(o.yeni)}</div>`;
      const ana = { degistir: ['uygula', 'Uygula'], ekle: ['uygula', 'Ekle'], ciz: ['ciz', 'Çiz'], soru: ['konus', 'Konuş'] }[o.tur] || ['konus', 'Konuş'];
      return `<div class="sy-oneri" data-i="${i}" data-tur="${o.tur}"><div class="sy-oneri-bas"><span>${ONERI_AD[o.tur] || 'Öneri'}</span>
        <button type="button" data-e="gec" title="Geç" aria-label="Öneriyi geç">×</button></div>${govdeHtml}${o.neden ? `<p>${kacis(o.neden)}</p>` : ''}
        <div class="sy-oneri-eylem"><button type="button" class="birinci" data-e="${ana[0]}">${ana[1]}</button>${ana[0] !== 'konus' ? '<button type="button" data-e="konus">Konuş</button>' : ''}${o.tur !== 'ciz' ? '<button type="button" data-e="ciz">Çiz</button>' : ''}</div></div>`;
    }
    function isaretle() {
      if (!window.Highlight || !CSS.highlights) return;
      CSS.highlights.set('codex-oneri', new Highlight(...oneriler.map((o) => o.aralik)));
      if (odakli && oneriler.includes(odakli)) CSS.highlights.set('codex-odak', new Highlight(odakli.aralik)); else CSS.highlights.delete('codex-odak');
    }
    function oneriCiz() {
      oneriler = oneriler.filter((o) => o.blok.isConnected);
      kenar.innerHTML = oneriler.map(kartYap).join('');
      kok.classList.toggle('oneri-var', oneriler.length > 0);
      isaretle(); yerlestir();
    }
    // Kartlar kendi bloklarının hizasında; üst üste binerse alta kayar
    function yerlestir() {
      const k = kap.getBoundingClientRect();
      let alt = 0;
      oneriler.forEach((o, i) => {
        const kart = kenar.children[i];
        if (!kart) return;
        const ust = Math.max(o.blok.getBoundingClientRect().top - k.top + kap.scrollTop, alt);
        kart.style.top = ust + 'px';
        alt = ust + kart.offsetHeight + 10;
      });
    }
    const oneriBitir = (o, ne) => {
      gecmis.push(`${ne}: ${o.tur} "${o.aranan}" → ${String(o.yeni).slice(0, 160)}`);
      oneriler = oneriler.filter((x) => x !== o); odakli = null; oneriCiz();
    };
    function uygula(o) {
      if (o.aralik.toString().replace(/\u00a0/g, ' ') !== o.aranan) o.aralik = aralikBul(metinEl(o.blok), o.aranan);
      if (o.tur === 'degistir') {
        if (!o.aralik) { oneriBitir(o, 'metin değişmişti'); return; }
        const [ilk, ...kalan] = String(o.yeni).split('\n');
        const t = document.createElement('template');
        t.innerHTML = satirIciHtml(alintiSade(ilk) === ilk ? ilk : ilk.replace(/^(#{1,3} |[-*] |> )/, ''));
        o.aralik.deleteContents(); o.aralik.insertNode(t.content);
        let son = o.blok;
        for (const b of kalan.length ? ayristir(kalan.join('\n')) : []) if (b.metin || b.tur === 'hr') son = ekle(son, b);
      } else {
        let son = o.blok;
        for (const b of ayristir(o.yeni)) son = ekle(son, b);
      }
      numaralandir(); oneriBitir(o, 'uygulandı'); planla();
    }
    kenar.addEventListener('mousedown', (e) => {
      const b = e.target.closest('[data-e]'), kart = e.target.closest('.sy-oneri');
      if (!b || !kart) return;
      e.preventDefault();
      const o = oneriler[Number(kart.dataset.i)];
      if (!o) return;
      if (b.dataset.e === 'gec') oneriBitir(o, 'geçildi');
      else if (b.dataset.e === 'uygula') uygula(o);
      else { (b.dataset.e === 'ciz' ? oneri.ciz : oneri.konus)?.(o); oneriBitir(o, b.dataset.e === 'ciz' ? 'çizime gönderildi' : 'konuşmaya taşındı'); }
    });
    kenar.addEventListener('mouseover', (e) => { const kart = e.target.closest('.sy-oneri'); const o = kart && oneriler[Number(kart.dataset.i)]; if (o !== odakli) { odakli = o || null; isaretle(); } });
    kenar.addEventListener('mouseleave', () => { odakli = null; isaretle(); });
    alan.addEventListener('input', () => { if (oneriler.length) requestAnimationFrame(() => { oneriler = oneriler.filter((o) => o.blok.isConnected && o.aralik.toString()); oneriCiz(); }); });
    const boyGozcu = new ResizeObserver(() => { if (oneriler.length) yerlestir(); aiYerlestir(); });
    boyGozcu.observe(kap);

    // Codex kutusu (K-033): seçilen bloklar ya da imlecin bölümü üstünde Toparla, Geçmişle değerlendir ya da serbest istek.
    // Sonuç önce önizlenir; yerine koymak ya da altına eklemek senin elinde, yerine konan geri alınır.
    const AI_AD = { toparla: 'Toparla', gecmis: 'Geçmişle değerlendir', serbest: 'Codex' };
    const AI_IS = { toparla: 'toparlıyor', gecmis: 'geçmişine bakıyor', serbest: 'çalışıyor' };
    const aiKutu = document.createElement('div');
    aiKutu.className = 'sy-ai'; aiKutu.hidden = true;
    kok.appendChild(aiKutu);
    let aiDurum = null;
    // İmlecin bölümü: üstteki ilk # ya da ## başlıktan bir sonrakine kadar; başlık yoksa baştan
    function bolumBloklari(blok) {
      const hepsi = [...alan.children], i = Math.max(0, hepsi.indexOf(blok));
      let bas = i;
      while (bas > 0 && !/^h[12]$/.test(hepsi[bas].dataset.tur)) bas--;
      let son = bas + 1;
      while (son < hepsi.length && !/^h[12]$/.test(hepsi[son].dataset.tur)) son++;
      return hepsi.slice(bas, son);
    }
    function aiAc(eylem, kapsam, istek = '', metin = null) {
      kapsam = kapsam.filter((x) => x.isConnected);
      while (kapsam.length > 1 && !metinEl(kapsam[kapsam.length - 1])?.textContent.trim()) kapsam.pop();
      if (!ai || !kapsam.some((x) => metinEl(x)?.textContent.trim())) { if (durum) durum('Codex\'e verilecek yazı yok'); return; }
      aiKapat();
      const d = aiDurum = { eylem, kapsam, istek, kaynak: metin ?? mdYaz(kapsam.map(blokOku)), sonuc: null };
      kapsam.forEach((x) => x.classList.add('sy-ai-kapsam'));
      aiCiz();
      simdiKaydet().then(() => ai(eylem, d.kaynak, istek))
        .then((r) => { if (aiDurum === d) { d.sonuc = r; aiCiz(); } })
        .catch((h) => { if (aiDurum === d) { d.hata = h.message || 'Olmadı'; aiCiz(); } });
    }
    function aiCiz() {
      const d = aiDurum;
      if (!d) return;
      const bekliyor = !d.sonuc && !d.hata;
      let govde, eylem = '';
      if (d.kondu) { govde = '<p class="sy-ai-not">Yerine kondu.</p>'; eylem = '<button type="button" data-ai="geri">Geri al</button><button type="button" data-ai="kapat">Tamam</button>'; }
      else if (d.hata) { govde = `<p class="sy-ai-not">${kacis(d.hata)}</p>`; eylem = '<button type="button" class="birinci" data-ai="yeniden">Yeniden dene</button><button type="button" data-ai="kapat">Kapat</button>'; }
      else if (d.sonuc) {
        govde = `<div class="sy-ai-sonuc">${onizle(d.sonuc.metin)}</div>` + (d.sonuc.kaynaklar.length ? `<div class="sy-ai-kaynak">${d.sonuc.kaynaklar.map((k) => `<span>${kacis(k)}</span>`).join('')}</div>` : '');
        eylem = (d.eylem === 'gecmis' ? '' : '<button type="button" class="birinci" data-ai="koy">Yerine koy</button>')
          + `<button type="button"${d.eylem === 'gecmis' ? ' class="birinci"' : ''} data-ai="ekle">Altına ekle</button><button type="button" data-ai="yeniden">Yeniden</button>`;
      } else govde = '<div class="sy-ai-iskelet"><span></span><span></span><span></span></div>';
      aiKutu.innerHTML = `<div class="sy-ai-bas"><span class="sy-ai-yildiz">✦</span>${AI_AD[d.eylem]}${bekliyor ? `<em>${AI_IS[d.eylem]}<i></i><i></i><i></i></em>` : ''}<button type="button" data-ai="kapat" aria-label="Kapat" title="Kapat (Esc)">×</button></div>`
        + govde + (eylem ? `<div class="sy-ai-eylem">${eylem}</div>` : '')
        + (d.sonuc && !d.kondu ? '<input class="sy-ai-gir" placeholder="Codex\'e söyle: daha kısa, maddele, resmi yap…">' : '');
      aiKutu.hidden = false;
      aiYerlestir();
    }
    // Kutu bölümün hemen altında durur; altındaki yazı kutu kadar aşağı itilir (son bloğa geçici alt boşluk)
    function aiYerlestir() {
      const d = aiDurum;
      if (!d || aiKutu.hidden) return;
      const son = (d.kondu ? d.yeni : d.kapsam).filter((x) => x.isConnected).pop();
      if (!son) return aiKapat();
      if (d.alt && d.alt !== son) d.alt.style.marginBottom = '';
      d.alt = son;
      aiKutu.style.top = (son.getBoundingClientRect().bottom - kok.getBoundingClientRect().top + 8) + 'px';
      son.style.marginBottom = (aiKutu.offsetHeight + 20) + 'px';
    }
    function aiKapat() {
      const d = aiDurum;
      aiDurum = null;
      if (d) { [...d.kapsam, ...(d.yeni || [])].forEach((x) => x.classList.remove('sy-ai-kapsam')); if (d.alt) d.alt.style.marginBottom = ''; }
      aiKutu.hidden = true; aiKutu.innerHTML = '';
    }
    function aiKoy() {
      const d = aiDurum, yeni = d?.sonuc ? ayristir(d.sonuc.metin).map(blokYap) : [];
      if (!yeni.length || !d.kapsam[0]?.isConnected) return;
      d.eski = d.kapsam.map(blokOku);
      d.kapsam[0].before(...yeni);
      d.kapsam.forEach((x) => { x.style.marginBottom = ''; x.remove(); });
      d.yeni = yeni; d.kondu = true; d.alt = null;
      numaralandir(); planla(); aiCiz();
    }
    function aiGeriAl() {
      const d = aiDurum;
      if (!d?.eski || !d.yeni?.[0]?.isConnected) return aiKapat();
      d.yeni[0].before(...d.eski.map(blokYap));
      d.yeni.forEach((x) => x.remove());
      d.yeni = []; aiKapat(); numaralandir(); planla();
    }
    function aiEkle() {
      const d = aiDurum;
      let son = d?.kapsam.filter((x) => x.isConnected).pop();
      if (!son || !d.sonuc) return;
      son.style.marginBottom = '';
      for (const b of ayristir(d.sonuc.metin)) son = ekle(son, b);
      aiKapat(); numaralandir(); planla();
    }
    aiKutu.addEventListener('mousedown', (e) => {
      const b = e.target.closest('[data-ai]'), d = aiDurum;
      if (!b) return;
      e.preventDefault();
      if (b.dataset.ai === 'yeniden' && d) return void aiAc(d.eylem, d.kapsam, d.istek, d.eylem === 'serbest' ? d.kaynak : null);
      ({ kapat: aiKapat, koy: aiKoy, ekle: aiEkle, geri: aiGeriAl })[b.dataset.ai]?.();
    });
    aiKutu.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); aiKapat(); return; }
      const g = e.target.closest('.sy-ai-gir'), d = aiDurum;
      if (e.key === 'Enter' && g && g.value.trim() && d?.sonuc) { e.preventDefault(); aiAc('serbest', d.kapsam, g.value.trim(), d.sonuc.metin); }
    });
    cubukMenu.addEventListener('mousedown', (e) => {
      const b = e.target.closest('[data-ai-eylem]');
      if (!b) return;
      e.preventDefault();
      cubukMenu.hidden = true; cubuk.hidden = true;
      aiAc(b.dataset.aiEylem, secilenBloklar);
    });
    cubukMenu.addEventListener('keydown', (e) => {
      const g = e.target.closest('.sy-ai-gir');
      if (e.key === 'Escape') { cubukMenu.hidden = true; return; }
      if (e.key === 'Enter' && g?.value.trim()) { e.preventDefault(); const istek = g.value.trim(); g.value = ''; cubukMenu.hidden = true; cubuk.hidden = true; aiAc('serbest', secilenBloklar, istek); }
    });
    kap.addEventListener('keydown', (e) => { if (e.key === 'Escape' && aiDurum && !menuDurum && !aiKutu.contains(e.target)) aiKapat(); });
    alan.addEventListener('input', () => { if (aiDurum) requestAnimationFrame(aiYerlestir); });
    // "/" menüsünün Codex grubunda: imlecin bölümü üstünde
    if (ai) eylemler = [
      { ad: 'Toparla', ipucu: 'Bu bölümü düzenler, sesini korur', iz: '✦', ara: 'toparla duzenle duzelt yazim ai codex', calistir: (blok) => aiAc('toparla', bolumBloklari(blok)) },
      { ad: 'Geçmişle değerlendir', ipucu: 'Önceki notların ve kararlarınla karşılaştırır', iz: '◷', ara: 'gecmis degerlendir karsilastir hafiza ai codex', calistir: (blok) => aiAc('gecmis', bolumBloklari(blok)) },
      ...eylemler];

    return {
      kaydet: simdiKaydet,
      // Bırakılan dosyaların bağlantıları: bırakılan yerin altına (y yoksa sona) birer satır
      dosyalar(baglantilar, y) {
        let son = null;
        for (const b of alan.children) if (y !== undefined && b.getBoundingClientRect().top < y) son = b;
        if (!son) son = y === undefined ? alan.lastElementChild : null;
        if (son && son === alan.lastElementChild && son.dataset.tur === 'p' && !metinEl(son).textContent.trim()) son = son.previousElementSibling;
        for (const [ad, yol] of baglantilar) {
          const el = blokYap({ tur: 'p', metin: `[${ad}](${/^https?:/.test(yol) ? yol : '/' + yol})` });  // dosya ham/ yolu, link olduğu gibi
          son ? son.after(el) : alan.prepend(el);
          son = el;
        }
        if (son && !son.nextElementSibling) ekle(son, { tur: 'p', metin: '' });
        numaralandir(); planla();
      },
      // Canlı öneriyi aç/kapat (kapatınca kenar temizlenir)
      oneri(acik) { if (!acik) { clearTimeout(oneriSaat); oneriler = []; oneriCiz(); } else { sonIstenen = ''; oneriPlanla(); } },
      // Kullanıcının isteğiyle şimdi oku (K-074)
      oneriSimdi() { clearTimeout(oneriSaat); return oneriIste(true); },
      // Dışarıdan değişti (Codex sayfaya yazdı): yazılmamış değişiklik yoksa yeniden yükle
      yukle(s) {
        const imza = JSON.stringify({ title: s.title || '', govde: mdYaz(ayristir(s.govde)) });
        if (saat || imza === sonKayit) return false;
        baslikEl.textContent = s.title || '';
        alan.innerHTML = '';
        for (const b of ayristir(s.govde)) alan.appendChild(blokYap(b));
        numaralandir();
        sonKayit = imza; oneriler = []; oneriCiz();
        return true;
      },
      odak() { if (!baslikEl.textContent.trim()) odakla(baslikEl); else odakla(metinEl(alan.lastElementChild) || baslikEl, 'son'); },
      // Bilgi'den "Defter'e al" (K-038): Markdown sona eklenir, kaydedilir; senin tıklamanla, Codex kendiliğinden yapamaz
      sonaEkle(md) {
        let son = alan.lastElementChild;
        while (son && son.dataset.tur === 'p' && !metinEl(son)?.textContent.trim() && son.previousElementSibling) son = son.previousElementSibling;
        for (const b of ayristir(md)) son = ekle(son, b);
        if (!son.nextElementSibling) ekle(son, { tur: 'p', metin: '' });
        numaralandir(); planla();
        son.scrollIntoView({ block: 'nearest' });
      },
      // Dışarıdan Codex kutusu: seçim varsa seçilen bloklar, yoksa imlecin bölümü (Defter'in ⋯ menüsü için)
      codex(eylem) { const sb = secimBloklari(); const b = sb.length ? sb : bolumBloklari(secimBloklari()[0] || alan.lastElementChild); aiAc(eylem, b); },
      kapat() {
        aiKapat();
        document.removeEventListener('mousedown', disTik, true); document.removeEventListener('selectionchange', secimDinle);
        clearTimeout(oneriSaat); boyGozcu.disconnect(); oneri = null;
        if (window.CSS?.highlights) { CSS.highlights.delete('codex-oneri'); CSS.highlights.delete('codex-odak'); }
        return simdiKaydet();
      },
    };
  }

  window.SayfaDuzenleyici = { ac, ayristir, mdYaz, satirIci: satirIciHtml };
})();
