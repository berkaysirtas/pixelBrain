// Ortak beyin ağı (K-017, K-035): md'lerin birbirine bağlandığı sinir ağı. Kabuk (beyin.html) kullanır; bağımlılık yok.
// Düğüm: alan (merkez, emojisi ve çalışma alanı rengiyle), Defter bölümü, not, bilgi notu, pano, veri, isteğe bağlı konuşma.
// Çalışma alanı görünmez bir çapa: alanlarını kümeler. Bağ: ağaç (güçlü) ve gerçek atıf (Defter'deki yol ve not kodu, bilgi
// notunun kaynağı, not → pano). Yerleşim kuvvetle, tohum sabit: her açılışta aynı resim.
(function () {
  const KUTLE = { ortak: 6, ca: 4, alan: 3.4, konu: 2.8, bolum: 1.3, bilgi: 1.5, pano: 1.4, konusma: 1.6, veri: 1.1, not: 1 };
  const RENK = { karar: 'var(--karar)', soru: 'var(--soru)', ilke: 'var(--ilke)', kaynak: 'var(--kaynak)' };
  const kod = (no) => (no || '').replace(/^([A-Z])-0*(\d+)$/, '$1$2');

  function kur(v, secenek = {}) {
    const izole = secenek.ca;
    const dugum = [], kenar = [], var_ = new Set();
    const ekle = (d, baglanan, uz, guc, gizli) => { if (var_.has(d.id)) return; var_.add(d.id); dugum.push(d); if (baglanan && var_.has(baglanan)) kenar.push([baglanan, d.id, uz, guc, gizli]); };
    const bagla = (a, b, uz, guc, gizli) => { if (a !== b && var_.has(a) && var_.has(b)) kenar.push([a, b, uz, guc, gizli]); };
    const alanCa = {}, sayfaAlan = {}, caRenk = {}, notYol = {};
    for (const ca of v.calisma.calisma_alanlari) {
      if (izole && ca.id !== izole) continue;
      caRenk[ca.id] = ca.renk || 'gri';
      ekle({ id: 'ca:' + ca.id, tur: 'ca', ad: ca.ad, ca: ca.id, gorunmez: true, halka: 1, sabit: !!izole });
      for (const a of ca.alanlar) {
        alanCa[a.id] = ca.id; sayfaAlan[a.sayfa] = a.id;
        ekle({ id: 'alan:' + a.id, tur: 'alan', ad: a.ad, px: a.ikon_px || null, ca: ca.id, alan: a.id, sayfa: a.sayfa, renkAdi: caRenk[ca.id], halka: 1 }, 'ca:' + ca.id, 150, 0.035, true);
      }
    }
    // Çalışma alanlarının çapaları birbirini zayıfça tutar: kümeler ayrı durur ama dağılmaz
    const capalar = dugum.filter((d) => d.tur === 'ca');
    capalar.forEach((a, i) => capalar.slice(i + 1).forEach((b) => kenar.push([a.id, b.id, 520, 0.002, true])));
    // Defter bölümleri: alanın notundaki ## başlıklar
    for (const d of v.defterler || []) {
      if (!alanCa[d.alan]) continue;
      const alanD = dugum.find((x) => x.id === 'alan:' + d.alan);
      if (alanD) { alanD.defter = d; alanD.dolu = d.dolu; }
      d.bolumler.forEach((b, i) => ekle({ id: `bolum:${d.alan}:${i}`, tur: 'bolum', ad: b, alan: d.alan, ca: alanCa[d.alan], renkAdi: caRenk[alanCa[d.alan]], defter: d, halka: 2 }, 'alan:' + d.alan, 70, 0.07));
    }
    const notlar = v.notlar.filter((n) => alanCa[n.alan]);
    const panoEkle = (ad, alan) => {
      if (var_.has('pano:' + ad)) return;
      // Pano kendi sayfasının alanına bağlanır; sayfası ağda olmayan (gizli ya da başka) alandaysa ağa girmez
      const b = v.panolar[ad] || {}, al = b.page ? sayfaAlan[b.page] : alan;
      if (!al) return;
      ekle({ id: 'pano:' + ad, tur: 'pano', ad: (b.title || ad).split(' (')[0], pano: ad, sayfa: b.page, alan: al, ca: alanCa[al], halka: 3 }, al && 'alan:' + al, 200, 0.01);
    };
    for (const n of notlar) if (n.pano) panoEkle(n.pano, n.alan);
    const varNot = new Set(notlar.map((n) => n.alan + ':' + n.no));
    for (const n of notlar) {
      const id = 'not:' + n.alan + ':' + n.no;
      notYol[`notlar/${n.alan}/${n.dosya}`] = id;
      ekle({ id, tur: 'not', ad: n.baslik, not: n, alan: n.alan, ca: alanCa[n.alan], renkAdi: caRenk[alanCa[n.alan]], soluk: n.durum === 'vazgecildi', halka: 3,
        varsayim: (n.veren === 'claude-varsayim' || n.veren === 'codex') && !n.onay, acik: n.durum === 'acik' },
        n.konu && var_.has('konu:' + n.konu) ? 'konu:' + n.konu : 'alan:' + n.alan, 48, 0.08);
    }
    const konusmaAdi = (kimlik) => (v.konusmalar.find((k) => k.ad.includes(String(kimlik || '').slice(-8))) || null);
    for (const n of notlar) {
      const id = 'not:' + n.alan + ':' + n.no;
      if (n.pano) bagla(id, 'pano:' + n.pano, 160, 0.004);
      for (const m of new Set((n.govde || '').match(/\b[KSIR]-\d{3}\b/g) || [])) if (m !== n.no && varNot.has(n.alan + ':' + m)) bagla(id, 'not:' + n.alan + ':' + m, 120, 0.004);
      if (secenek.konusma) { const k = konusmaAdi(n.konusma); if (k) { ekle({ id: 'konusma:' + k.ad, tur: 'konusma', ad: k.kaynak + ' · ' + k.ad.slice(8, 10) + '.' + k.ad.slice(5, 7), konusma: k, halka: 2 }); bagla(id, 'konusma:' + k.ad, 200, 0.002, true); } }
    }
    if (secenek.konusma && !izole) for (const k of v.konusmalar) ekle({ id: 'konusma:' + k.ad, tur: 'konusma', ad: k.kaynak + ' · ' + k.ad.slice(8, 10) + '.' + k.ad.slice(5, 7), konusma: k, halka: 2 });
    for (const d of v.veriler) {
      const p = d.yol.split('/'), ca = p[2], alan = p.length > 4 ? p[3] : '', konu = p.length > 5 ? p[4] : '';
      if (izole && ca !== izole) continue;
      const hedef = konu && var_.has('konu:' + konu) ? 'konu:' + konu : alan && var_.has('alan:' + alan) ? 'alan:' + alan : 'ca:' + ca;
      if (var_.has(hedef)) ekle({ id: 'veri:' + d.yol, tur: 'veri', ad: d.ad.replace(/^\d{8}-\d{6}-/, ''), veri: d, ca, halka: 3 }, hedef, 60, 0.05, hedef.startsWith('ca:'));
    }
    // Gerçek atıflar: Defter'deki not kodu ve dosya yolları
    const yolDugumu = (y) => notYol[y] || (y.startsWith('panolar/') ? (panoEkle(y.slice(8), ''), 'pano:' + y.slice(8)) : y.startsWith('ham/') ? 'veri:' + decodeURIComponent(y)
      : (/^sayfalar\/([\w-]+)\//.exec(y) || [])[1] ? 'alan:' + /^sayfalar\/([\w-]+)\//.exec(y)[1] : '');
    for (const d of v.defterler || []) {
      if (!alanCa[d.alan]) continue;
      for (const k of d.kodlar) bagla('alan:' + d.alan, 'not:' + d.alan + ':' + k, 110, 0.006);
      for (const y of d.yollar) bagla('alan:' + d.alan, yolDugumu(y), 140, 0.006);
    }
    // Bilgi notları: kalıcı öğrenimler, kaynaklarına bağlı; kaynağı yoksa projesinin kümesine
    for (const b of v.bilgi || []) {
      if (izole && b.proje && b.proje !== izole) continue;
      const hedefler = b.yollar.map(yolDugumu).filter((x) => x && var_.has(x));
      if (izole && !hedefler.length && b.proje !== izole) continue;
      ekle({ id: 'bilgi:' + b.yol, tur: 'bilgi', ad: b.ad, bilgi: b, ca: b.proje, halka: 2 }, hedefler[0] || (b.proje && 'ca:' + b.proje), 110, 0.03, !hedefler.length);
      hedefler.slice(1).forEach((h) => bagla('bilgi:' + b.yol, h, 140, 0.008));
    }
    // Tarama bulguları (Codex'in denetimi): işaretlenen düğümler halkayla görünür
    for (const f of v.bulgular || []) {
      const hedef = dugum.find((d) => d.id === yolDugumu(f.burada || ''));
      if (hedef) (hedef.bulgular = hedef.bulgular || []).push(f);
    }
    return { dugum, kenar };
  }

  function yerlestir(ag, W, H) {
    const { dugum } = ag, n = dugum.length, idx = new Map(dugum.map((d, i) => [d.id, i]));
    dugum.forEach((d, i) => { const a = i * 2.399, r = 40 + (d.halka ?? 2) * 95; d.x = W / 2 + Math.cos(a) * r; d.y = H / 2 + Math.sin(a) * r * 0.8; });
    const bag = ag.kenar.map(([a, b, uz, guc, gizli]) => [idx.get(a), idx.get(b), uz || 60, guc || 0.05, !!gizli]).filter(([a, b]) => a != null && b != null);
    const tur = 600;
    for (let t = 0; t < tur; t++) {
      const fx = new Float64Array(n), fy = new Float64Array(n);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const dx = dugum[i].x - dugum[j].x, dy = dugum[i].y - dugum[j].y, d2 = dx * dx + dy * dy + 0.01, d = Math.sqrt(d2);
        const f = 2000 * (KUTLE[dugum[i].tur] || 1) * (KUTLE[dugum[j].tur] || 1) / d2;
        fx[i] += f * dx / d; fy[i] += f * dy / d; fx[j] -= f * dx / d; fy[j] -= f * dy / d;
      }
      for (const [a, b, uz, guc] of bag) {
        const dx = dugum[b].x - dugum[a].x, dy = dugum[b].y - dugum[a].y, d = Math.sqrt(dx * dx + dy * dy) + 0.01, f = (d - uz) * guc;
        fx[a] += f * dx / d; fy[a] += f * dy / d; fx[b] -= f * dx / d; fy[b] -= f * dy / d;
      }
      const soguk = 1 - t / tur;
      dugum.forEach((d, i) => {
        if (d.sabit) { d.x = W / 2; d.y = H / 2; return; }
        fx[i] += (W / 2 - d.x) * 0.0022; fy[i] += (H / 2 - d.y) * 0.003;
        d.x = Math.min(W - 60, Math.max(60, d.x + Math.max(-14, Math.min(14, fx[i])) * soguk));
        d.y = Math.min(H - 26, Math.max(26, d.y + Math.max(-14, Math.min(14, fy[i])) * soguk));
      });
    }
    ag.bag = bag;
    return ag;
  }

  // Çizim: tek canvas, canlı kuvvet benzetimi (Obsidian gibi). Düğüm nokta, etiket yakınlaştıkça belirir; üstüne gelince
  // komşular parlar, düğüm sürüklenince ağ esner. Benzetim durulunca döngü durur, yalnız etkileşimde çizer.
  const YARICAP = { ortak: 14, ca: 0, alan: 13, konu: 6.5, bolum: 4, bilgi: 5.5, pano: 4.5, konusma: 5.5, veri: 4, not: 4.5 };
  const ESIK = { ortak: -1, ca: 9, alan: -1, konu: 0.45, bolum: 0.8, bilgi: 0.7, konusma: 0.9, pano: 1.0, veri: 1.1, not: 1.0 };
  const RENK_ADLARI = ['gri', 'kahve', 'turuncu', 'sari', 'yesil', 'mavi', 'mor', 'pembe', 'kirmizi'];
  const katla = (s) => String(s).toLocaleLowerCase('tr').replace(/[çğıöşü]/g, (c) => 'cgiosu'['çğıöşü'.indexOf(c)]);
  const kisalt = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
  // Alan düğümünün pixel ikonu: 12×12 ızgara, düğüm çapına sığar; kenar yumuşatma kapalı, pikseller keskin
  function pxCiz(c, R, d) {
    const s = (d.r * 1.3) / 12, x0 = d.x - 6 * s, y0 = d.y - 6 * s;
    const p = { k: R.yazi, a: d.renk, b: d.acikTon || (d.acikTon = karistir(d.renk, '#ffffff', 0.62)), c: R.soru };
    c.save(); c.imageSmoothingEnabled = false;
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) { const f = p[d.px[y]?.[x]]; if (f) { c.fillStyle = f; c.fillRect(x0 + x * s, y0 + y * s, s * 1.02, s * 1.02); } }
    c.restore();
  }
  function karistir(a, b, t) {  // iki #rrggbb rengi t oranında karıştırır (açık ton)
    const h = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
    if (!/^#[0-9a-f]{6}$/i.test(a)) return a;
    const [p, q] = [h(a), h(b)];
    return '#' + p.map((v, i) => Math.round(v + (q[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  function renkler() {
    const s = getComputedStyle(document.documentElement), v = (n) => s.getPropertyValue(n).trim();
    return { ters: v('--ters'), yazi: v('--yazi'), yazi2: v('--yazi-2'), soluk: v('--soluk'), soluk2: v('--soluk-2'), kenar: v('--kenar-2'),
      kenar3: v('--kenar-3'), kart: v('--kart'), vurgu: v('--karar'), claude: v('--claude'), karar: v('--karar'), soru: v('--soru'), ilke: v('--ilke'), kaynak: v('--kaynak'),
      tehlike: v('--tehlike'), r: Object.fromEntries(RENK_ADLARI.map((r) => [r, v('--r-' + r)])), rz: Object.fromEntries(RENK_ADLARI.map((r) => [r, v('--r-' + r + '-z')])) };
  }

  function ciz(kap, ag, { sec, ac, dogrulama = false, kenar: pay = { u: 0, s: 0, a: 0, l: 0 } } = {}) {
    kap.innerHTML = '<canvas class="ag-tuval"></canvas><button type="button" class="ag-sigdir">Sığdır</button>';
    const tuval = kap.firstChild, c = tuval.getContext('2d'), R = renkler(), yazitipi = getComputedStyle(document.body).fontFamily;
    const D = ag.dugum, B = ag.bag, komsu = D.map(() => new Set());
    B.forEach(([a, b]) => { komsu[a].add(b); komsu[b].add(a); });
    // Renk çalışma alanından (K-031); bilgi notu koyu, pano gri, veri ve konuşma kendi rengiyle
    const renk = (d) => (d.renkAdi && (d.tur === 'not' || d.tur === 'bolum' || d.tur === 'alan') ? R.r[d.renkAdi] || R.soluk
      : d.tur === 'not' ? R[d.not.tur] || R.soluk : d.tur === 'konusma' ? R.claude : d.tur === 'veri' ? R.kaynak
      : d.tur === 'pano' ? R.kenar3 : d.tur === 'konu' ? R.soluk2 : d.tur === 'bilgi' ? R.yazi2 : R.ters);
    D.forEach((d, i) => {
      d.vx = 0; d.vy = 0; d.renk = renk(d);
      d.r = (YARICAP[d.tur] ?? 5) + (d.tur === 'not' || d.tur === 'konu' || d.tur === 'bilgi' ? Math.min(4, Math.sqrt(komsu[i].size) * 0.7) : d.tur === 'alan' ? Math.min(6, Math.sqrt(komsu[i].size)) : 0);
      d.etiket = d.tur === 'not' ? kod(d.not.no) + '  ' + kisalt(d.ad, 40) : kisalt(d.ad, 36);
      d.ara = katla(d.ad + ' ' + (d.tur === 'not' ? d.not.no + ' ' + (d.not.govde || '').slice(0, 400) : ''));
    });
    const g = { x: 0, y: 0, z: 1 };
    let hedefG = null, alfa = 0.2, hedefAlfa = 0, dongu = 0, tut = null, uzerinde = -1, secili = -1, ilk = true, otoSigdir = true, eslesen = null;

    // Benzetim: yerleşimle aynı kuvvetler, hızla ve sönümle; alfa düştükçe durulur
    function adim() {
      const n = D.length, fx = new Float64Array(n), fy = new Float64Array(n);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const dx = D[i].x - D[j].x, dy = D[i].y - D[j].y, d2 = dx * dx + dy * dy + 0.01, d = Math.sqrt(d2);
        const f = 2000 * (KUTLE[D[i].tur] || 1) * (KUTLE[D[j].tur] || 1) / d2;
        fx[i] += f * dx / d; fy[i] += f * dy / d; fx[j] -= f * dx / d; fy[j] -= f * dy / d;
      }
      for (const [a, b, uz, guc] of B) {
        const dx = D[b].x - D[a].x, dy = D[b].y - D[a].y, d = Math.sqrt(dx * dx + dy * dy) + 0.01, f = (d - uz) * guc;
        fx[a] += f * dx / d; fy[a] += f * dy / d; fx[b] -= f * dx / d; fy[b] -= f * dy / d;
      }
      D.forEach((d, i) => {
        if (d.sabit || (tut && tut.i === i && tut.oynadi)) { d.vx = d.vy = 0; return; }
        fx[i] += (ag.W / 2 - d.x) * 0.0022; fy[i] += (ag.H / 2 - d.y) * 0.003;
        d.vx = (d.vx + Math.max(-14, Math.min(14, fx[i])) * alfa) * 0.62;
        d.vy = (d.vy + Math.max(-14, Math.min(14, fy[i])) * alfa) * 0.62;
        d.x += d.vx; d.y += d.vy;
      });
    }

    function boya() {
      const w = kap.clientWidth, h = kap.clientHeight, oran = devicePixelRatio || 1;
      c.setTransform(oran, 0, 0, oran, 0, 0); c.clearRect(0, 0, w, h);
      const odak = uzerinde >= 0 ? uzerinde : secili, yakin = odak >= 0 ? komsu[odak] : null;
      const acik = (i) => (odak >= 0 ? i === odak || yakin.has(i) : !eslesen || eslesen.has(i));
      c.setTransform(oran * g.z, 0, 0, oran * g.z, oran * g.x, oran * g.y);
      c.lineWidth = 1 / g.z; c.strokeStyle = R.kenar; c.globalAlpha = odak >= 0 || eslesen ? 0.35 : 1;
      c.beginPath();
      for (const [a, b, , , gizli] of B) if (!gizli && a !== odak && b !== odak) { c.moveTo(D[a].x, D[a].y); c.lineTo(D[b].x, D[b].y); }
      c.stroke();
      if (odak >= 0) {
        c.globalAlpha = 0.85; c.strokeStyle = R.vurgu; c.lineWidth = 1.5 / g.z; c.beginPath();
        for (const [a, b] of B) if (a === odak || b === odak) { c.moveTo(D[a].x, D[a].y); c.lineTo(D[b].x, D[b].y); }
        c.stroke();
      }
      D.forEach((d, i) => {
        if (d.gorunmez) return;
        c.globalAlpha = (acik(i) ? 1 : 0.14) * (d.soluk ? 0.45 : 1);
        c.beginPath();
        // Obsidian gibi (K-080): her düğüm yuvarlak; tür rengi ayırır
        c.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        if (d.tur === 'alan') {  // merkez: açık zemin, renkli kenar, içinde pixel art ikon (K-039)
          c.fillStyle = R.rz[d.renkAdi] || R.kart; c.fill(); c.lineWidth = 2 / g.z; c.strokeStyle = d.renk; c.stroke();
          if (d.px) pxCiz(c, R, d);
        } else if (dogrulama && d.varsayim) {  // varsayım: içi boş, kesikli; onayını bekler
          c.fillStyle = R.kart; c.fill(); c.setLineDash([3 / g.z, 2 / g.z]); c.lineWidth = 1.6 / g.z; c.strokeStyle = d.renk; c.stroke(); c.setLineDash([]);
        } else { c.fillStyle = d.renk; c.fill(); c.lineWidth = 1.5 / g.z; c.strokeStyle = R.kart; c.stroke(); }
        if (dogrulama && d.bulgular) { c.globalAlpha = acik(i) ? 1 : 0.3; c.lineWidth = 2 / g.z; c.strokeStyle = R.tehlike; c.beginPath(); c.arc(d.x, d.y, d.r + 4 / g.z, 0, Math.PI * 2); c.stroke(); }
        else if (dogrulama && d.acik) { c.globalAlpha = acik(i) ? 0.9 : 0.3; c.lineWidth = 1.6 / g.z; c.strokeStyle = R.soru; c.beginPath(); c.arc(d.x, d.y, d.r + 3 / g.z, 0, Math.PI * 2); c.stroke(); }
        if (i === odak) { c.globalAlpha = 0.9; c.lineWidth = 2 / g.z; c.strokeStyle = R.vurgu; c.beginPath(); c.arc(d.x, d.y, d.r + 3.5 / g.z, 0, Math.PI * 2); c.stroke(); }
      });
      // Etiketler ekran ölçeğinde: yakınlaşınca büyümez, keskin kalır
      c.setTransform(oran, 0, 0, oran, 0, 0);
      c.textAlign = 'center'; c.textBaseline = 'top'; c.lineJoin = 'round';
      D.forEach((d, i) => {
        if (d.gorunmez) return;
        const a = odak >= 0 || eslesen ? (acik(i) ? 1 : 0) : Math.max(0, Math.min(1, (g.z - (ESIK[d.tur] ?? 1)) / 0.25));
        if (a < 0.03) return;
        const sx = d.x * g.z + g.x, sy = (d.y + d.r) * g.z + g.y + 5;
        if (sx < -240 || sx > w + 240 || sy < -20 || sy > h + 20) return;
        const ust = d.tur === 'ortak' || d.tur === 'ca' || d.tur === 'alan';
        c.font = `${ust ? 600 : d.tur === 'alan' ? 500 : 400} ${ust ? 13 : d.tur === 'alan' || d.tur === 'konu' ? 12 : 11.5}px ${yazitipi}`;
        c.globalAlpha = a * (d.soluk ? 0.6 : 1);
        c.lineWidth = 4; c.strokeStyle = R.kart; c.strokeText(d.etiket, sx, sy);
        c.fillStyle = ust || i === odak ? R.yazi : d.tur === 'not' || d.tur === 'pano' || d.tur === 'veri' ? R.soluk : R.yazi2;
        c.fillText(d.etiket, sx, sy);
      });
      c.globalAlpha = 1;
    }

    function tik() {
      dongu = 0;
      if (!kap.isConnected) { gozlem.disconnect(); return; }
      const canli = alfa > 0.004 || hedefAlfa > 0;
      if (canli) { adim(); alfa += (hedefAlfa - alfa) * 0.03; if (otoSigdir && alfa <= 0.004) { otoSigdir = false; hedefG = sigdirHedef(); } }
      if (hedefG) {
        for (const k of ['x', 'y', 'z']) g[k] += (hedefG[k] - g[k]) * 0.16;
        if (Math.abs(hedefG.z - g.z) < 0.0005 && Math.abs(hedefG.x - g.x) < 0.3) { Object.assign(g, hedefG); hedefG = null; }
      }
      boya();
      if (canli || hedefG) iste();
    }
    const iste = () => { if (!dongu) dongu = requestAnimationFrame(tik); };

    function sigdirHedef() {
      const w = kap.clientWidth, h = kap.clientHeight;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const d of D) { if (d.gorunmez) continue; x0 = Math.min(x0, d.x); y0 = Math.min(y0, d.y); x1 = Math.max(x1, d.x); y1 = Math.max(y1, d.y); }
      // Üstteki hap ve sağdaki kart gibi yüzen parçaların altında kalmasın: sığdırma kalan alana
      const gw = w - pay.l - pay.s, gh = h - pay.u - pay.a;
      const z = Math.min(gw / (x1 - x0 + 160), gh / (y1 - y0 + 120), 1.6);
      return { z, x: pay.l + gw / 2 - ((x0 + x1) / 2) * z, y: pay.u + gh / 2 - ((y0 + y1) / 2) * z };
    }
    const sigdir = () => { hedefG = sigdirHedef(); iste(); };

    function secim(id) {
      secili = D.findIndex((d) => d.id === id);
      if (sec) sec(secili >= 0 ? D[secili] : null, secili >= 0 ? B.filter(([a, b]) => a === secili || b === secili).length : 0);
      iste();
    }

    const nokta = (e) => { const r = kap.getBoundingClientRect(); return { x: (e.clientX - r.left - g.x) / g.z, y: (e.clientY - r.top - g.y) / g.z }; };
    const bul = (p) => {
      for (let i = D.length - 1; i >= 0; i--) { const d = D[i], dx = d.x - p.x, dy = d.y - p.y; if (!d.gorunmez && dx * dx + dy * dy <= (d.r + 5 / g.z) ** 2) return i; }
      return -1;
    };
    kap.onpointerdown = (e) => {
      if (e.target.closest('button')) return;
      const i = bul(nokta(e));
      hedefG = null; otoSigdir = false;
      tut = { i, pan: i < 0 || D[i].sabit, oynadi: false, bx: e.clientX, by: e.clientY, x: e.clientX - g.x, y: e.clientY - g.y };
      kap.setPointerCapture(e.pointerId); kap.classList.add('ag-tutuyor');
    };
    kap.onpointermove = (e) => {
      if (!tut) {
        const i = bul(nokta(e));
        if (i !== uzerinde) { uzerinde = i; kap.classList.toggle('ag-uzerinde', i >= 0); iste(); }
        return;
      }
      if (!tut.oynadi && Math.abs(e.clientX - tut.bx) + Math.abs(e.clientY - tut.by) < 4) return;
      tut.oynadi = true;
      if (tut.pan) { g.x = e.clientX - tut.x; g.y = e.clientY - tut.y; }
      else { const p = nokta(e), d = D[tut.i]; d.x = p.x; d.y = p.y; hedefAlfa = 0.22; alfa = Math.max(alfa, 0.1); uzerinde = tut.i; }
      iste();
    };
    kap.onpointerup = () => {
      if (tut && !tut.oynadi) secim(tut.i < 0 ? '' : secili === tut.i ? '' : D[tut.i].id);
      tut = null; hedefAlfa = 0; kap.classList.remove('ag-tutuyor'); iste();
    };
    kap.onpointerleave = () => { if (!tut && uzerinde >= 0) { uzerinde = -1; kap.classList.remove('ag-uzerinde'); iste(); } };
    kap.ondblclick = (e) => { const i = bul(nokta(e)); if (i >= 0 && ac) { secim(D[i].id); ac(D[i]); } };
    kap.onwheel = (e) => {
      e.preventDefault(); hedefG = null; otoSigdir = false;
      const r = kap.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      const z = Math.min(4, Math.max(0.15, g.z * Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0018))));
      g.x = mx - (mx - g.x) * (z / g.z); g.y = my - (my - g.y) * (z / g.z); g.z = z; iste();
    };
    kap.querySelector('.ag-sigdir').onclick = sigdir;
    const gozlem = new ResizeObserver(() => {
      const w = kap.clientWidth, h = kap.clientHeight, oran = devicePixelRatio || 1;
      if (!w || !h) return;
      tuval.width = Math.round(w * oran); tuval.height = Math.round(h * oran); tuval.style.width = w + 'px'; tuval.style.height = h + 'px';
      if (ilk) { // açılış: hafif uzaktan sığdır konumuna süzülür
        ilk = false; const t = sigdirHedef();
        Object.assign(g, { z: t.z * 0.88, x: w / 2 - (w / 2 - t.x) * 0.88, y: h / 2 - (h / 2 - t.y) * 0.88 }); hedefG = t;
      }
      iste();
    });
    gozlem.observe(kap);
    // Arama: eşleşen düğümler ve komşuları parlar; Enter ilk eşleşene gider
    function ara(q) {
      const k = katla(q.trim());
      eslesen = k ? new Set(D.map((d, i) => (!d.gorunmez && d.ara.includes(k) ? i : -1)).filter((i) => i >= 0)) : null;
      iste();
      return eslesen ? eslesen.size : -1;
    }
    function git(id) {
      const i = id ? D.findIndex((d) => d.id === id) : eslesen ? [...eslesen][0] ?? -1 : -1;
      if (i < 0) return;
      const w = kap.clientWidth, h = kap.clientHeight, z = Math.max(g.z, 1.1);
      hedefG = { z, x: w / 2 - D[i].x * z, y: h / 2 - D[i].y * z }; otoSigdir = false;
      secim(D[i].id);
    }
    return { secim, sigdir, ara, git };
  }

  window.BeyinAg = {
    hazirla(veri, secenek = {}) { const ag = kur(veri, secenek); ag.W = Math.max(900, 260 + Math.sqrt(ag.dugum.length) * 110); ag.H = Math.round(ag.W * 0.72); return yerlestir(ag, ag.W, ag.H); },
    ciz, kod,
  };
})();
