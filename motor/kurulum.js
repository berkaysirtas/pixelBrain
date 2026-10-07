// İlk kurulum turu (K-051; panolar ArayuzKurulumK2 ve ArayuzKurulumSon): gerçek ekranın üstünde yedi adım. Hedef öğe sarı
// halkayla ışıklanır, ekranın gerisi kararır; yanında programın pixel ikonu ve kısa balon. Son adım "Seni tanıyayım" kartı.
// Kendiliğinden yalnız ilk açılışta başlar (Core.md boş, tur görülmemiş); sonra ⌘K ya da Ayarlar › Program › Turu başlat.
// Core.md'ye yalnız kullanıcının değiştirdiği alan yazılır; mevcut kimlik şablonla ezilmez. beyin.html'in yardımcılarını
// (al, gonder, depo, kacis, bildir, pxSvg, PROGRAM_PX, coreBolumleri, calisma, yanCiz, renkOf) çağrı anında kullanır.
(() => {
  const ADIMLAR = [
    { ad: 'Hoş geldin', baslik: "Beyin'e hoş geldin", metin: 'Sen yazarsın, Codex düzenler; hepsi tek ağda birleşir. İki dakikada gezdireyim.' },
    { ad: 'Çalışma alanları', hedef: '#rayListe', baslik: 'Çalışma alanların', metin: 'Hayatının büyük parçaları burada. İzole olanı Codex ayrı tutar; içindekiler başka yere karışmaz.' },
    { ad: 'Alan', hedef: '.sy-sekmeler', alanda: true, baslik: 'Her alan üç sayfa', metin: "Defter yalnız senin: sen yazarsın, Codex dokunmaz. Bilgi Codex'in: okur, özetler, kaynağını gösterir. Çizim ikinizin tuvali." },
    { ad: 'Veri ekle', hedef: '#veriDugme', alanda: true, baslik: 'Veri ekle', metin: 'Dosyayı bırak ya da YouTube linkini yapıştır. Codex okur, özetler, doğru alana koyar.' },
    { ad: 'Codex', hedef: ['.panel', '[data-ust-codex]'], alanda: true, baslik: 'Codex yanında', metin: 'Sağ bölmede konuş. Neyi okuyup nereye yazdığını tuvalde canlı görürsün; ⌘J açar, kapatır.' },
    { ad: 'Ortak beyin', hedef: '#ortakDugme', baslik: 'Ortak beyin ve ⌘K', metin: 'Her şey tek ağda birleşir. ⌘K ile her çalışma alanına, alana ve panoya gidersin.' },
    { ad: 'Seni tanıyayım', son: true },
  ];
  const ONERI = ['Kişisel', 'İşim', 'Ürünlerim'];
  let tur = null;

  // Öğretici dersler (K-052, K-062) ogretici.js'de: window.ogreticiKur yedi ders alanını kurar.

  const stil = document.createElement('style');
  stil.textContent = `
#tur{position:fixed;inset:0;z-index:300}
#tur.karanlik{background:color-mix(in srgb,var(--yazi) 46%,transparent)}
.tur-delik{position:fixed;border-radius:10px;pointer-events:none;transition:left .25s ease,top .25s ease,width .25s ease,height .25s ease;
  box-shadow:0 0 0 3px var(--r-sari),0 0 0 9px color-mix(in srgb,var(--r-sari) 35%,transparent),0 0 0 200vmax color-mix(in srgb,var(--yazi) 46%,transparent)}
.tur-balon{position:fixed;display:flex;gap:14px;align-items:flex-start;transition:left .25s ease,top .25s ease}
.tur-ikon{width:72px;height:72px;flex:none;border-radius:16px;background:var(--kart);display:grid;place-items:center;box-shadow:0 12px 30px -16px rgba(0,0,0,.5)}
.tur-kart{flex:1;min-width:0;border-radius:16px;background:var(--kart);color:var(--yazi);padding:16px 18px;box-shadow:0 18px 50px -20px rgba(0,0,0,.5);position:relative}
.tur-ok{position:absolute;left:-7px;top:26px;width:14px;height:14px;background:var(--kart);transform:rotate(45deg)}
.tur-kart small{font-size:12px;color:var(--soluk-2)}
.tur-kart h3{margin:4px 0 6px;font-size:18px}
.tur-kart p{margin:0;font-size:14px;line-height:1.55;color:var(--yazi-2)}
.tur-alt{display:flex;align-items:center;margin-top:14px}
.tur-nokta{display:flex;gap:6px}
.tur-nokta i{width:6px;height:6px;border-radius:99px;background:var(--kenar-3);transition:width .2s}
.tur-nokta i.on{width:18px;background:var(--yazi)}
.tur-dugmeler{margin-left:auto;display:flex;gap:4px}
.tur-dugmeler button{height:36px;padding:0 16px;border:0;border-radius:9px;background:none;font:inherit;font-size:14px;color:var(--soluk);cursor:pointer}
.tur-dugmeler button:hover{color:var(--yazi)}
.tur-dugmeler .ana,.tur-dugmeler .ana:hover{background:var(--yazi);color:var(--kart)}
.tur-dugmeler button:disabled{opacity:.5;cursor:default}
.tur-dugmeler button:focus{outline:none}.tur-dugmeler button:focus-visible{box-shadow:0 0 0 2px var(--kart),0 0 0 4px var(--kenar-3)}
#tur.son{background-color:var(--yan);background-image:radial-gradient(var(--nokta) 1.1px,transparent 1.4px);background-size:22px 22px;overflow:auto}
.tur-son{position:relative;margin:70px auto 40px;width:min(600px,calc(100vw - 32px));box-sizing:border-box;border-radius:20px;background:var(--kart);color:var(--yazi);
  box-shadow:0 0 0 1px var(--kenar),0 30px 80px -40px rgba(55,53,47,.55);padding:30px 34px}
.tur-son-bas{display:flex;gap:14px;align-items:center;margin-bottom:22px}
.tur-son-bas small{font-size:12.5px;color:var(--soluk-2)}
.tur-son-bas h2{margin:2px 0 0;font-size:24px;letter-spacing:-.02em}
.tur-son label,.tur-alan{display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--soluk);margin-bottom:16px}
.tur-son input{height:40px;border:0;border-radius:10px;background:var(--yan);padding:0 12px;font:inherit;font-size:14.5px;color:var(--yazi);outline:none}
.tur-son input:focus{box-shadow:0 0 0 2px var(--kenar-3)}
.tur-cipler{display:flex;gap:8px;flex-wrap:wrap}
.tur-cip{height:34px;padding:0 12px;border:0;border-radius:99px;display:inline-flex;align-items:center;gap:8px;font:inherit;font-size:13.5px;background:var(--yan);color:var(--yazi-2);cursor:pointer}
.tur-cip[aria-pressed="true"]{background:var(--yazi);color:var(--kart)}
.tur-cip input{height:26px;width:150px;padding:0;background:transparent;color:inherit}
.tur-cip input:focus{box-shadow:none}
.tur-not{margin:4px 0 0;font-size:12.5px;color:var(--soluk)}
.tur-ogren{display:grid;grid-template-columns:auto 1fr;column-gap:10px;align-items:center;width:100%;margin:2px 0 14px;padding:10px 12px;border:0;border-radius:12px;background:var(--yan);font:inherit;font-size:14px;color:var(--yazi);text-align:left;cursor:pointer}
.tur-ogren small{grid-column:2;font-size:12.5px;color:var(--soluk)}
.tur-ogren .anahtar{grid-row:span 2;position:relative;width:30px;height:18px;border-radius:99px;background:var(--kenar-3);transition:background .15s}
.tur-ogren .anahtar::after{content:'';position:absolute;left:2px;top:2px;width:14px;height:14px;border-radius:99px;background:var(--kart);transition:transform .15s}
.tur-ogren[aria-pressed="true"] .anahtar{background:var(--yazi)}.tur-ogren[aria-pressed="true"] .anahtar::after{transform:translateX(12px)}
@media (prefers-reduced-motion:reduce){.tur-delik,.tur-balon,.tur-nokta i{transition:none}}`;
  document.head.append(stil);

  const kat = (s) => String(s || '').toLocaleLowerCase('tr');
  const ilkSatir = (s) => (String(s || '').split('\n').map((l) => l.trim()).find(Boolean) || '').slice(0, 160);
  const noktalar = (i) => `<span class="tur-nokta">${ADIMLAR.map((_, j) => `<i${j === i ? ' class="on"' : ''}></i>`).join('')}</span>`;
  const programIkonu = (boy) => (typeof kivSvg === 'function' ? kivSvg('normal', boy) : pxSvg(PROGRAM_PX, 'mor', boy));  // anlatan Kıvılcım (K-064)
  function gorunen(seciciler) {
    for (const s of [].concat(seciciler)) {
      const e = document.querySelector(s), r = e?.getBoundingClientRect();
      if (r && r.width > 0 && r.height > 0) return e;
    }
    return null;
  }
  async function bekle(seciciler) {
    for (let i = 0; i < 25; i++) {
      const e = gorunen(seciciler);
      if (e) return e;
      await new Promise((r) => setTimeout(r, 100));
    }
    return null;
  }

  async function turBaslat(secenek = {}) {
    turKapat();
    const liste = calisma.calisma_alanlari.filter((c) => !c.gizli);
    const ca = liste.find((c) => c.id === secenek.ca) || liste.find((c) => c.alanlar.length) || null;
    const alan = ca ? ca.alanlar.find((a) => a.id === secenek.alan) || ca.alanlar[0] || null : null;
    tur = { i: 0, ca, alan, hedef: null, kok: document.createElement('div') };
    tur.kok.id = 'tur';
    tur.kok.innerHTML = '<div class="tur-delik" hidden></div><div class="tur-balon" role="dialog" aria-modal="true" aria-label="Beyin turu"></div>';
    tur.kok.addEventListener('click', tikla);
    document.body.append(tur.kok);
    addEventListener('keydown', tus, true);
    addEventListener('resize', yerlestir);
    adimGoster();
  }

  function turKapat(durum) {
    if (!tur) return;
    tur.kok.remove();
    removeEventListener('keydown', tus, true);
    removeEventListener('resize', yerlestir);
    tur = null;
    if (durum) depo.koy('kurulum', durum);
  }

  async function adimGoster() {
    const a = ADIMLAR[tur.i], no = tur.i;
    if (a.son) return sonCiz();
    tur.kok.classList.remove('son');
    if (a.alanda && tur.alan) {
      const h = `#/c/${tur.ca.id}/${tur.alan.id}/yazi`;
      if (location.hash !== h) location.hash = h;
    }
    const hedef = a.hedef ? await bekle(a.hedef) : null;
    if (!tur || tur.i !== no) return;
    tur.hedef = hedef;
    const b = tur.kok.querySelector('.tur-balon');
    b.hidden = false;
    b.innerHTML = `<span class="tur-ikon">${programIkonu(44)}</span><div class="tur-kart"><i class="tur-ok"></i>
      <small>${no + 1} / ${ADIMLAR.length} · ${kacis(a.ad)}</small><h3>${kacis(a.baslik)}</h3><p>${kacis(a.metin)}</p>
      <div class="tur-alt">${noktalar(no)}<span class="tur-dugmeler"><button type="button" data-tur="gec">Turu geç</button><button type="button" class="ana" data-tur="ileri">İleri</button></span></div></div>`;
    yerlestir();
    b.querySelector('[data-tur="ileri"]').focus();
  }

  // Balon hedefin altına, sığmazsa sağına, o da sığmazsa soluna; hedef yoksa ekranın ortasına
  function yerlestir() {
    if (!tur || ADIMLAR[tur.i].son) return;
    const d = tur.kok.querySelector('.tur-delik'), b = tur.kok.querySelector('.tur-balon');
    const W = innerWidth, H = innerHeight, bw = Math.min(430, W - 32);
    b.style.width = bw + 'px';
    const bh = b.offsetHeight || 190;
    if (!tur.hedef?.isConnected) {
      d.hidden = true; tur.kok.classList.add('karanlik');
      b.style.left = (W - bw) / 2 + 'px'; b.style.top = Math.max(16, (H - bh) / 2.4) + 'px';
      return;
    }
    tur.kok.classList.remove('karanlik');
    const r = tur.hedef.getBoundingClientRect(), p = 6;
    Object.assign(d.style, { left: r.left - p + 'px', top: r.top - p + 'px', width: r.width + 2 * p + 'px', height: r.height + 2 * p + 'px' });
    d.hidden = false;
    let x = r.left, y = r.bottom + 24;
    if (y + bh > H - 16) [x, y] = r.right + 24 + bw < W - 16 ? [r.right + 24, r.top] : [r.left - 24 - bw, r.top];
    b.style.left = Math.max(16, Math.min(x, W - bw - 16)) + 'px';
    b.style.top = Math.max(16, Math.min(y, H - bh - 16)) + 'px';
  }

  function git(n) {
    if (!tur) return;
    tur.i = Math.max(0, Math.min(ADIMLAR.length - 1, tur.i + n));
    adimGoster();
  }

  function tus(e) {
    if (!tur) return;
    e.stopPropagation();  // tur açıkken programın kısayolları (V, ⌘K) çalışmaz
    const son = ADIMLAR[tur.i].son;
    if (e.key === 'Escape') { e.preventDefault(); turKapat('gecildi'); }
    else if (son) { if (e.key === 'Enter') { e.preventDefault(); basla(); } }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); git(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); git(-1); }
  }

  function tikla(e) {
    const d = e.target.closest('[data-tur]')?.dataset.tur;
    if (d === 'ileri') return git(1);
    if (d === 'gec') return turKapat('gecildi');
    if (d === 'basla') return basla();
    const og = e.target.closest('[data-ogren]');
    if (og) return og.setAttribute('aria-pressed', String(og.getAttribute('aria-pressed') !== 'true'));
    const cip = e.target.closest('.tur-cip');
    if (!cip) return;
    tur.kok.querySelectorAll('.tur-cip').forEach((c) => c.setAttribute('aria-pressed', String(c === cip)));
    if (cip.dataset.kendi !== undefined && !cip.querySelector('input')) {
      cip.innerHTML = '<input id="turKendi" placeholder="Çalışma alanının adı" autocomplete="off" spellcheck="false">';
      cip.querySelector('input').focus();
    }
  }

  async function sonCiz() {
    tur.kok.classList.add('son'); tur.kok.classList.remove('karanlik');
    tur.kok.querySelector('.tur-delik').hidden = true;
    tur.kok.querySelector('.tur-balon').hidden = true;
    const ben = await al('/api/ben').catch(() => ({ core: '' }));
    if (!tur) return;
    const bolumler = coreBolumleri(ben.core);
    const bul = (f) => bolumler.find((x) => f(kat(x.baslik)));
    const hitapB = bul(HITAP), isB = bul(NE_IS), kimB = bul((b) => b.startsWith('kimim'));
    const hitap0 = hitapB ? ilkSatir(hitapB.govde) : (/^\s*([A-ZÇĞİÖŞÜ][a-zçğıöşü]+)/.exec(kimB?.govde || '') || [])[1] || '';
    tur.ben = { bolumler, hitap0, is0: isB ? ilkSatir(isB.govde) : '' };
    const mevcut = calisma.calisma_alanlari.filter((c) => !c.gizli);
    const cipler = mevcut.length
      ? mevcut.map((c) => `<button type="button" class="tur-cip" data-ca="${kacis(c.id)}" aria-pressed="${c.id === tur.ca?.id}">${c.ikon_px ? pxSvg(c.ikon_px, renkOf(c), 18) : ''}${kacis(c.ad)}</button>`).join('')
      : ONERI.map((ad, i) => `<button type="button" class="tur-cip" data-yeni="${kacis(ad)}" aria-pressed="${i === 0}">${kacis(ad)}</button>`).join('')
        + '<button type="button" class="tur-cip" data-kendi aria-pressed="false">+ Kendi adın</button>';
    let kart = tur.kok.querySelector('.tur-son');
    if (!kart) { kart = document.createElement('div'); kart.className = 'tur-son'; tur.kok.append(kart); }
    kart.setAttribute('role', 'dialog'); kart.setAttribute('aria-modal', 'true'); kart.setAttribute('aria-label', 'Seni tanıyayım');
    kart.innerHTML = `<div class="tur-son-bas">${programIkonu(40)}<div><small>${ADIMLAR.length} / ${ADIMLAR.length}</small><h2>Seni tanıyayım</h2></div></div>
      <label>Sana nasıl hitap edeyim?<input id="turHitap" value="${kacis(tur.ben.hitap0)}" autocomplete="off" spellcheck="false"></label>
      <label>Ne iş yapıyorsun?<input id="turIs" value="${kacis(tur.ben.is0)}" placeholder="Örn. şirketleri uçtan uca dijitalleştiriyorum" autocomplete="off"></label>
      <div class="tur-alan">${mevcut.length ? 'Nereden başlayalım?' : 'İlk çalışma alanın'}<div class="tur-cipler">${cipler}</div></div>
      <button type="button" class="tur-ogren" data-ogren aria-pressed="${!mevcut.length}"><span class="anahtar"></span>Beyin'i öğren alanını da aç<small>yedi kısa ders; her adımı yaptığında kendiliğinden işaretlenir</small></button>
      <p class="tur-not">Cevapların Ayarlar › Ben'e yazılır; istediğin zaman değiştirirsin.</p>
      <div class="tur-alt">${noktalar(ADIMLAR.length - 1)}<span class="tur-dugmeler"><button type="button" class="ana" data-tur="basla">Başla</button></span></div>`;
    kart.querySelector('#turHitap').focus();
  }

  // Core.md bölümünü yerinde güncelle: bölüm varsa yalnız eski satır değişir (gerisi kalır), yoksa bölüm eklenir
  const HITAP = (b) => b === 'hitap', NE_IS = (b) => b.startsWith('ne iş');
  function bolumYaz(bolumler, esles, baslik, eski, yeni, basa) {
    const b = bolumler.find((x) => esles(kat(x.baslik)));
    if (b) { b.govde = eski && b.govde.includes(eski) ? b.govde.replace(eski, yeni) : (yeni + '\n' + b.govde).trim(); return; }
    const yer = basa ? (bolumler[0] && !bolumler[0].baslik ? 1 : 0) : bolumler.length;
    bolumler.splice(yer, 0, { baslik, govde: yeni });
  }

  async function basla() {
    const dugme = tur?.kok.querySelector('[data-tur="basla"]');
    if (!dugme || dugme.disabled) return;
    dugme.disabled = true;
    const deger = (s) => (tur.kok.querySelector(s)?.value || '').trim();
    const hitap = deger('#turHitap'), is = deger('#turIs'), { bolumler, hitap0, is0 } = tur.ben;
    let yazildi = false, hedef = '';
    try {
      if (hitap && hitap !== hitap0) { bolumYaz(bolumler, HITAP, 'HİTAP', hitap0, hitap, true); yazildi = true; }
      if (is && is !== is0) { bolumYaz(bolumler, NE_IS, 'NE İŞ YAPIYORUM', is0, is, false); yazildi = true; }
      if (yazildi) await gonder('/api/ben', { ad: 'core', metin: bolumler.map((x) => (x.baslik ? `# ${x.baslik}\n` : '') + x.govde).join('\n\n') });
      const sec = tur.kok.querySelector('.tur-cip[aria-pressed="true"]');
      if (sec?.dataset.ca) hedef = `#/c/${sec.dataset.ca}`;
      else if (sec) {
        const ad = sec.dataset.yeni || deger('#turKendi');
        if (!ad) throw new Error('Çalışma alanına bir ad yaz');
        const id = await gonder('/api/calisma', { ad });
        calisma = await al('/api/calisma'); yanCiz();
        hedef = `#/c/${id}`;
      }
    } catch (h) {
      dugme.disabled = false;
      return bildir(h.message);
    }
    const ogren = tur.kok.querySelector('[data-ogren]')?.getAttribute('aria-pressed') === 'true';
    turKapat('bitti');
    bildir(yazildi ? "Hazır. Cevaplarını Ayarlar › Ben'e yazdım" : 'Hazır');
    if (ogren) await window.ogreticiKur().catch(() => { if (hedef) location.hash = hedef; });
    else if (hedef) location.hash = hedef;
  }

  window.turBaslat = turBaslat;
  window.komutEylemleri = () => [{ ad: 'Turu başlat', ek: 'İlk kurulum', tur: 'Eylem', ik: `<span class="ikon">${programIkonu(16)}</span>`, eylem: () => turBaslat() },
    { ad: "Beyin'i öğren", ek: 'Yedi ders', tur: 'Eylem', ik: `<span class="ikon">${programIkonu(16)}</span>`, eylem: () => window.ogreticiKur().catch(() => {}) }];
  document.addEventListener('click', (e) => { if (e.target.closest('[data-tur-baslat]')) turBaslat(); });
  // İlk açılış: Core.md boşsa (ya da hafızanın başlangıç şablonundaysa) ve tur hiç görülmediyse kendiliğinden başlar
  addEventListener('load', () => setTimeout(async () => {
    if (depo.al('kurulum') || tur) return;
    const ben = await al('/api/ben').catch(() => null);
    const core = String(ben?.core || '');
    if (ben && (!core.trim() || /Henüz kişiselleştirilmedi/.test(core))) turBaslat();
  }, 900));
})();
