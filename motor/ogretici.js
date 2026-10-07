// Öğretici dersler (K-062, pano ArayuzOgreticiT2): "Beyin'i öğren" çalışma alanında yedi ders. Her dersin Defter'inde anlatım ve
// Dene listesi; program adımı yaptığını görünce satırı işaretler, Codex turu harcamaz. İlerlemenin tek kaynağı Defter'deki
// işaretli Dene satırlarıdır: elle işaretlenen de sayılır. Çalışma alanı sayfası dersleri ilerleme halkasıyla gösterir, yanda
// seçili dersin adımları; Göster sıradaki adımın yerini sarı halkayla ışıklar. Adımlar programın gördüğü gerçek eylemlerle
// anlaşılır: kayıt ve tuval istekleri (fetch), sekme ve adres değişimi, tıklama, kısayol. beyin.html yardımcılarını (al, gonder,
// kacis, bildir, depo, calisma, yanCiz, yerOku, caBul, pxSvg, PROGRAM_PX, kivSvg) çağrı anında kullanır.
(() => {
  const AD = "Beyin'i öğren";
  const ifr = () => document.querySelector('#icerik iframe');
  const sec = (o, s) => o.el?.closest?.(s);
  const DERSLER = [
    { anahtar: 'defter', ad: 'Defter', baslik: 'Senin notun', renk: 'mavi',
      ozet: 'Defter yalnız senin: sen yazarsın, Codex kendiliğinden dokunmaz. Yazdığın her şey kendiliğinden kaydedilir.',
      anlatim: "Burada yalnız sen yazarsın; Codex buraya kendiliğinden dokunmaz. Düşündüğün gibi yaz, düzen sonra gelir. Yazdığın her şey kendiliğinden kaydedilir.",
      kapanis: "Defter, Bilgi'nin ve Çizim'in kaynağıdır. Ne kadar ham yazarsan Codex o kadar iyi düzenler. Satırları kenardan sürükleyerek birden fazla seçebilir, topluca silebilir ya da Kıvılcım'a verebilirsin.",
      adimlar: [
        { metin: 'Bu sayfaya aklındaki bir fikri yaz', hedef: '#syYazi .sy-bloklar', kosul: (o, c) => c.kayit(o)?.yazi.some((l) => !/^#/.test(l)) },
        { metin: 'Bir satırı "## " ile başlat, başlık olsun', hedef: '#syYazi .sy-bloklar', kosul: (o, c) => c.kayit(o)?.yazi.some((l) => /^#{1,3} /.test(l)) },
        { metin: 'Bir kelimeyi seç, ⌘B ile kalın yap', hedef: '#syYazi .sy-bloklar', kosul: (o, c) => c.kayit(o)?.bicim.some((l) => l.includes('**')) },
        { metin: 'Bir yazıyı seç, ⌘⇧K ile link ekle', hedef: '#syYazi .sy-bloklar', kosul: (o, c) => c.kayit(o)?.bicim.some((l) => /\]\(https?:/.test(l)) },
      ] },
    { anahtar: 'bilgi', ad: 'Bilgi', baslik: "Codex'in sayfası", renk: 'mor',
      ozet: 'Bilgi, Defter\'in düzenlenmiş hâli: Codex okur, özetler, bölümlere ayırır, kaynağını gösterir. Sen okursun.',
      notlar: `## Okuma alışkanlığı, ham notlar

- Akşam telefon elimdeyken okuyamıyorum
- Sabah 20 dakika denedim, üç gün sürdü
- Kısa denemeler daha kolay bitiyor
- Kitabı çantada taşıyınca beklerken okuyorum
- Bir arkadaşla aynı kitabı okumak motive etti`,
      anlatim: "Bilgi bu notların düzenlenmiş hâli: Codex okur, özetler, bölümlere ayırır, kaynağını gösterir. Sen okursun; beğendiğin satırı Defter'e geri alırsın.",
      kapanis: "Kendi notunu ekleyip Bilgi'de \"ile güncelle\" › Özetle dersen Codex sayfayı senin notunla yeniden yazar; Defter'ine dokunmaz.",
      bilgi: `## Özet

- Okuma, uygun an ve kısa hedefle sürüyor; telefon en büyük engel. Ayrıntı: [Engeller](#engeller) ve [İşe yarayanlar](#işe-yarayanlar).
- Bu sayfayı program örnek olarak hazırladı; kaynağı bu alanın [Defter](DEFTER.md)'i.

## Engeller

- Akşam telefon dikkati dağıtıyor
- Uzun hedefler yarıda kalıyor

## İşe yarayanlar

- Kısa denemeler kolay bitiyor
- Kitap çantada olunca bekleme anları okumaya dönüyor
- Bir arkadaşla aynı kitabı okumak motive ediyor

## Sonraki adım

| Deneme | Süre | Ölçüt |
|---|---|---|
| Sabah 10 dakika | 1 hafta | 5 gün tutarsa uzat |
| Telefonu başka odaya koy | 1 hafta | Akşam okunan sayfa |`,
      adimlar: [
        { metin: 'Üstte Bilgi sekmesine geç', hedef: '[data-sy-sekme="bilgi"]', kosul: (o, c) => o.tur === 'rota' && c.y.sekme === 'bilgi' },
        { metin: "Özet'teki bölüm etiketine tıkla, o bölüme gider", git: 'bilgi', hedef: '#syBilgi .bl-cip[data-bl-bolum]', kosul: (o) => !!sec(o, '#syBilgi [data-bl-bolum]') },
        { metin: 'Bir bölümün başlığına tıklayıp kapat, sonra yeniden aç', git: 'bilgi', hedef: '#syBilgi .bl-bolum2 summary',
          kosul: (o, c) => { if (o.tur !== 'ac' || !o.el.matches?.('#syBilgi .bl-bolum2')) return false; if (!o.el.open) c.iz.kapatti = true; return o.el.open && !!c.iz.kapatti; } },
        { metin: 'Bir satırın üstüne gel, "Defter\'e al" ile buraya geri al', git: 'bilgi', hedef: '#syBilgi .bl-ozet', kosul: (o) => !!sec(o, '#syBilgi [data-defter-al]') },
      ] },
    { anahtar: 'cizim', ad: 'Çizim', baslik: 'Tuvalde düşün', renk: 'turuncu',
      ozet: 'Çizim alanın tuvali. Not, şekil, ok ve metin koyarsın; Codex aynı tuvale pano çizer.',
      anlatim: 'Not, şekil, bağ ve metin koyarsın; Codex aynı tuvale pano çizer. Notu taşırsın, öğeleri bağlarsın; yanlış bir şey olursa ⌘Z geri alır.',
      kapanis: 'İstersen Codex\'e "bu alanı bir pano olarak çiz" yaz; çizerken nerede çalıştığını tuvalde görürsün.',
      tuval: [
        { tur: 'metin', x: 0, y: 0, text: "Çizim'e hoş geldin" },
        { tur: 'not', x: 0, y: 70, fill: 'yellow', text: 'Beni sürükle. Çift tıklayınca yazarsın.' },
        { tur: 'bag', x: 230, y: 125, dx: 90, dy: 0 },
        { tur: 'sekil', x: 330, y: 70, sekil: 'daire', text: 'Bir şekil' },
      ],
      adimlar: [
        { metin: 'Üstte Çizim sekmesine geç', hedef: '[data-sy-sekme="cizim"]', kosul: (o, c) => o.tur === 'rota' && c.y.sekme === 'cizim' },
        { metin: 'Sarı notu tut, başka bir yere sürükle', git: 'cizim', hedef: 'iframe:.yapiskan', kosul: (o) => o.yol === '/api/tasi' },
        { metin: 'Araç çubuğundan Not ya da Şekil seç, tuvale bir tane koy', git: 'cizim', hedef: 'iframe:.araclar [data-arac="not"]',
          kosul: (o) => o.yol === '/api/tuval-oge' && o.govde.is === 'ekle' && o.govde.tur !== 'bag' },
        { metin: 'Bağ aracıyla iki öğeyi birbirine bağla', git: 'cizim', hedef: 'iframe:.araclar [data-arac="bag"]',
          kosul: (o) => o.yol === '/api/tuval-oge' && o.govde.is === 'ekle' && o.govde.tur === 'bag' },
        { metin: 'Bir öğeyi seçip sil, sonra ⌘Z ile geri al', git: 'cizim', hedef: 'iframe:#geriAl', kosul: (o) => o.yol === '/api/tuval-oge' && o.govde.is === 'geri' },
      ] },
    { anahtar: 'veri', ad: 'Veri ve video', baslik: 'Kaynak ekle', renk: 'yesil',
      ozet: 'Dosya, link, not ya da YouTube videosu "+ Veri" ile bulunduğun alana girer; Codex okur, Bilgi\'ye kaynağıyla yazar.',
      anlatim: "Dosya, link, not ya da YouTube videosu: hepsi \"+ Veri\" ile bulunduğun alana girer. Codex okur, özetler, Bilgi'ye kaynağıyla yazar. Video indirilir, dinlenir, kareleri çıkarılır.",
      kapanis: "Defter'e sürüklediğin link de veri olur ve bıraktığın yere bağ olarak girer.",
      adimlar: [
        { metin: 'Üstteki "+ Veri"ye bas ya da V tuşuna', hedef: '#veriDugme',
          kosul: (o) => !!sec(o, '#veriDugme') || o.tur === 'mesaj-veri' || (o.tur === 'tus' && (o.e.key === 'v' || o.e.key === 'V') && !o.e.metaKey && !o.e.ctrlKey && !yaziYeri(o.e.target)) },
        { metin: 'Bir dosya bırak ya da bir link yapıştır', hedef: '#veriDugme', kosul: (o) => o.yol === '/api/veri' },
        { metin: "Bilgi'ye geç, eklediğin şeyi Kaynaklar kartında gör", hedef: '[data-sy-sekme="bilgi"]', kosul: (o, c) => o.tur === 'rota' && c.y.sekme === 'bilgi' && c.bitti(1) },
        { metin: "Kaynaklar'a bir YouTube linki yapıştır, Codex izlesin", git: 'bilgi', hedef: '#blKaynak .kv-ekle', kosul: (o) => o.yol === '/api/video' },
      ] },
    { anahtar: 'codex', ad: 'Codex ile konuş', baslik: 'Kıvılcım yanında', renk: 'mor',
      ozet: 'Sağdaki bölme Codex: bu alanı görür, sorunu cevaplar, Bilgi\'yi ve Çizim\'i düzenler. Defter\'e kendiliğinden dokunmaz.',
      anlatim: "Sağdaki bölme Codex: bu alanın Defter'ini, Bilgi'sini ve Çizim'ini görür. Ona soru sorarsın, düzenlemesini istersin; çalışırken üstteki Kıvılcım hareket eder, neyi okuyup nereye yazdığını tuvalde görürsün.",
      kapanis: "Codex Defter'ine kendiliğinden dokunmaz; yazdığı her şey Bilgi'ye gider.",
      adimlar: [
        { metin: '⌘J ile Codex bölmesini kapat, sonra yeniden aç', hedef: '[data-ust-codex]',
          kosul: (o, c) => (o.tur === 'mesaj-panel' || !!sec(o, '[data-ust-codex], #panelKapat') || (o.tur === 'tus' && (o.e.metaKey || o.e.ctrlKey) && (o.e.key === 'j' || o.e.key === 'J')))
            && (c.iz.panel = (c.iz.panel || 0) + 1) >= 2 },
        { metin: "Codex'e bu alan hakkında bir soru yaz", hedef: '.cx-yaz textarea', kosul: (o, c) => o.yol === '/api/codex/gonder' && o.govde.alan === c.st.alan },
        { metin: 'Model düğmesinden modeli ya da düşünme seviyesini değiştir', hedef: '#cxModel', kosul: (o) => !!sec(o, '[data-model], [data-efor], [data-internet]') },
        { metin: "Codex bitince Bilgi'ye geç, yazdığını gör", hedef: '[data-sy-sekme="bilgi"]', kosul: (o, c) => o.tur === 'rota' && c.y.sekme === 'bilgi' && c.bitti(1) },
      ] },
    { anahtar: 'izolasyon', ad: 'İzolasyon', baslik: 'Ayrı tut', renk: 'gri',
      ozet: 'İzole çalışma alanında Codex diğer çalışma alanlarını görmez; buradaki bilgi başka yere karışmaz.',
      anlatim: 'Bu çalışma alanı izole: Codex burada çalışırken diğer çalışma alanlarını görmez, buradaki bilgi de başka yere karışmaz. Üstteki kilitli "İzole" etiketi bunu gösterir. Müşteri işleri gibi ayrı kalması gereken şeyler için kullanılır.',
      kapanis: 'İzole bir çalışma alanının alanları ortak beyinde de kendi kümesinde durur.',
      adimlar: [
        { metin: 'Üstteki "İzole" etiketine tıkla, kilidi aç; sonra yeniden tıkla, kilitle', hedef: '#ustIzole [data-ust-izole]', her: true,
          kosul: (o, c) => o.yol === '/api/izole' && o.govde.id === c.ca && o.govde.izole === true },
        { metin: "Ayarlar › Çalışma alanları'nda hangi alanların izole olduğuna bak", yer: false, hedef: '#ayarlarDugme', her: true,
          kosul: (o, c) => !!sec(o, '[data-sekme="ayarlar:calisma"]') || (o.tur === 'rota' && c.y.tur === 'ayarlar' && depo.al('sekme:ayarlar') === 'calisma') },
        { metin: 'Codex\'e "Kişisel\'de ne var?" diye sor; buradan göremediğini söyler', hedef: '.cx-yaz textarea',
          kosul: (o, c) => o.yol === '/api/codex/gonder' && o.govde.alan === c.st.alan },
      ] },
    { anahtar: 'ortak', ad: 'Ortak beyin ve ⌘K', baslik: 'Her şey tek ağda', renk: 'mavi',
      ozet: 'Bütün çalışma alanların tek ağda birleşir. ⌘K her yerden her yere götürür.',
      anlatim: "Bütün çalışma alanların tek ağda birleşir: Ağ'da alanlar ve aralarındaki bağlar, Ben'de seni nasıl tanıdığım, Son eklenenler'de yeni gelenler. ⌘K her yerden her yere götürür.",
      kapanis: 'Ağda bir düğüme tıklarsan o alana gidersin; izole çalışma alanları ağda kendi kümesinde durur.',
      adimlar: [
        { metin: "⌘K'ya bas, bir alanın adını yaz, Enter ile git", yer: false, hedef: null, her: true,
          kosul: (o) => o.tur === 'rota' && Date.now() - komutZaman < 30000 },
        { metin: 'Raydaki Ortak beyin düğmesine bas, ağı aç', yer: false, hedef: '#ortakDugme', her: true, kosul: (o, c) => o.tur === 'rota' && c.y.tur === 'ortak' },
        { metin: 'Ortak beyinde Ben sekmesine geç', yer: '#/ortak', hedef: '[data-sekme="ortak:ben"]', her: true,
          kosul: (o, c) => !!sec(o, '[data-sekme="ortak:ben"]') || (o.tur === 'rota' && c.y.tur === 'ben') },
        { metin: 'Son eklenenler sekmesinde en yeni şeye bak', yer: '#/ortak', hedef: '[data-sekme="ortak:son"]', her: true, kosul: (o) => !!sec(o, '[data-sekme="ortak:son"]') },
      ] },
  ];
  const yaziYeri = (t) => !!t?.closest?.('input, textarea, [contenteditable="true"], [contenteditable=""]');
  const norm = (l) => l.trim().replace(/^[-*] \[[ xX]\] /, '- ');  // işaret kutusu sayılmaz
  const sade = (l) => norm(l).replace(/\*\*/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim();  // biçim ve link de sayılmaz
  const defterMd = (d) => `${d.notlar ? d.notlar + '\n\n' : `## ${d.baslik}\n\n`}${d.anlatim}\n\n## Dene\n\n${d.adimlar.map((a) => `- [ ] ${a.metin}`).join('\n')}\n\n${d.kapanis}`;
  const satirlar = (md) => String(md || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const dersAlani = (d, n, ek = '') => `${n + 1}. ${d.ad}${ek}`;

  // Öğretici çalışma alanı ve dersin alanı: kayıttaki ogretici/ders alanlarıyla, yoksa adla
  const ogreticiMi = (ca) => !!ca && (ca.ogretici || ca.ad === AD);
  const ogreticiCa = () => {  // içinde bulunulan öğretici önce (iki tane varsa), yoksa ilki
    const y = yerOku(), bu = y.ca ? caBul(y.ca) : null;
    return ogreticiMi(bu) ? bu : calisma.calisma_alanlari.find((c) => c.ogretici) || calisma.calisma_alanlari.find((c) => c.ad === AD);
  };
  const dersOf = (a) => a && (DERSLER.find((d) => d.anahtar === a.ders) || DERSLER.find((d, n) => a.ad.startsWith(dersAlani(d, n))));
  function dersYeri(d) {  // { ca, alan } ya da null
    const ca = ogreticiCa(), a = ca?.alanlar.find((x) => dersOf(x) === d);
    return a ? { ca: ca.id, alan: a.id } : null;
  }

  // Ders durumu: Defter'deki Dene satırlarından; kayıt görülünce gövdeden yeniden okunur
  const durum = new Map();
  function govdedenOku(d, st, govde) {
    const isaretli = new Set(satirlar(govde).filter((l) => /^[-*] \[[xX]\] /.test(l)).map((l) => l.replace(/^[-*] \[[xX]\] /, '')));
    st.bitti = new Set(d.adimlar.map((a, i) => (isaretli.has(a.metin) ? i : -1)).filter((i) => i >= 0));
    st.govde = govde;
  }
  async function dersDurum(d, tazele) {
    const yerB = dersYeri(d);
    if (!yerB) return null;
    let st = durum.get(d.anahtar);
    if (st && st.alan === yerB.alan && !tazele) return st;
    const s = await gonder('/api/alan-not', { alan: yerB.alan }).catch(() => null);
    if (!s) return null;
    st = { ...yerB, defter: s.id, bitti: new Set(), iz: st?.alan === yerB.alan ? st.iz : {} };
    govdedenOku(d, st, s.govde);
    durum.set(d.anahtar, st);
    return st;
  }

  // Adımı işaretle: Defter açıksa düzenleyicideki kutu (kendi kaydı gider), değilse dosyada satır
  let sessiz = 0;
  async function isaretle(d, i) {
    const st = await dersDurum(d);
    if (!st || st.bitti.has(i)) return;
    st.bitti.add(i);
    const metin = d.adimlar[i].metin;
    const yuzey = document.querySelector(`.sy-yuzey[data-not="${st.defter}"]`);
    const kutu = yuzey && [...yuzey.querySelectorAll('.sy-blok')].find((b) => b.querySelector('.sy-kutu') && b.querySelector('.sy-metin')?.textContent.trim() === metin)?.querySelector('.sy-kutu');
    if (kutu) { if (!kutu.checked) { kutu.checked = true; kutu.dispatchEvent(new Event('change', { bubbles: true })); } }
    else if (!yuzey) {
      sessiz++;
      try {
        const s = await gonder('/api/alan-not', { alan: st.alan });
        const kac = metin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), yeni = s.govde.replace(new RegExp(`^([-*]) \\[ \\] ${kac}$`, 'm'), '$1 [x] ' + metin);
        if (yeni !== s.govde) { await gonder('/api/sayfa', { id: s.id, govde: yeni }); st.govde = yeni; }
      } catch {} finally { sessiz--; }
    }
    const y = yerOku(), icinde = (y.tur === 'calisma' || y.tur === 'alan') && y.ca === st.ca;
    const sonraki = d.adimlar.findIndex((_, j) => !st.bitti.has(j));
    if (icinde || isik) {
      if (sonraki < 0) { const n = DERSLER.indexOf(d), ileri = DERSLER.slice(n + 1).find((x) => durum.get(x.anahtar)?.bitti.size !== x.adimlar.length);
        bildir(`${d.ad} dersi bitti${ileri ? '. Sıradaki: ' + ileri.ad : '. Hepsi bitti!'}`); }
      else bildir('✓ ' + metin);
    }
    if (isik && isik.ders === d && isik.i === i) { isikKapat(); if (sonraki >= 0) setTimeout(() => goster(d, sonraki), 900); }
    if (y.tur === 'calisma' && y.ca === st.ca) sayfaCiz(caBul(st.ca));
  }

  // Olaylar: her biri, adımı o dersin alanında (ya da her yerde geçerli adımlarda) yapılınca işaretlenir
  let komutZaman = 0;
  async function olay(o) {
    const ca = ogreticiCa();
    if (!ca) return;
    const y = yerOku(), buradaki = y.tur === 'alan' && y.ca === ca.id ? dersOf(ca.alanlar.find((a) => a.id === y.alan)) : null;
    for (const d of DERSLER) {
      const kayitDers = o.yol === '/api/sayfa' && durum.get(d.anahtar)?.defter === o.govde.id;
      if (d !== buradaki && !kayitDers && !d.adimlar.some((a) => a.her)) continue;
      const st = await dersDurum(d);
      if (!st) continue;
      if (kayitDers) govdedenOku(d, st, o.govde.govde);  // elle işaretlenen kutular da sayılır
      // kayit: Defter'in kaydında şablonda olmayan satırlar; yazi yeni metin, bicim kalın ya da link eklenmiş satır
      const sablon = satirlar(defterMd(d)), sadeS = new Set(sablon.map(sade)), normS = new Set(sablon.map(norm));
      const c = { y, st, iz: st.iz, ca: ca.id, bitti: (j) => st.bitti.has(j),
        kayit: (x) => { if (x.yol !== '/api/sayfa' || x.govde.id !== st.defter) return null; const l = satirlar(x.govde.govde);
          return { yazi: l.filter((s) => !sadeS.has(sade(s))), bicim: l.filter((s) => !normS.has(norm(s))) }; } };
      for (const [i, a] of d.adimlar.entries()) {
        if (st.bitti.has(i) || (!a.her && d !== buradaki && !kayitDers)) continue;
        let tamam = false;
        try { tamam = !!a.kosul(o, c); } catch {}
        if (tamam) await isaretle(d, i);
      }
    }
  }
  const govdeOku = (b) => { try { return typeof b === 'string' ? JSON.parse(b) : {}; } catch { return {}; } };
  function fetchIzle(w) {  // kabuk ve tuval penceresi: başarılı POST isteği olay olur
    if (!w || w.__ogrIzli) return;
    const asil = w.fetch.bind(w);
    w.__ogrIzli = true;
    w.fetch = async (u, init) => {
      const r = await asil(u, init);
      if (r.ok && init?.method === 'POST' && !sessiz) { const yol = String(u).split('?')[0]; if (yol.startsWith('/api/')) setTimeout(() => olay({ tur: 'istek', yol, govde: govdeOku(init.body) }).catch(() => {}), 0); }
      return r;
    };
  }
  fetchIzle(window);
  setInterval(() => { try { fetchIzle(ifr()?.contentWindow); } catch {} }, 800);
  const calis = (o) => olay(o).catch(() => {});
  addEventListener('hashchange', () => setTimeout(() => calis({ tur: 'rota' }), 50));
  document.addEventListener('click', (e) => calis({ tur: 'tik', el: e.target }), true);
  document.addEventListener('toggle', (e) => calis({ tur: 'ac', el: e.target }), true);
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'k' || e.key === 'K')) komutZaman = Date.now();
    if (e.key === 'Escape' && isik) isikKapat();
    calis({ tur: 'tus', e });
  }, true);
  addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    const b = e.data?.beyin;
    if (b === 'ara') komutZaman = Date.now();
    if (b === 'panel') calis({ tur: 'mesaj-panel' });
    if (b === 'veri') calis({ tur: 'mesaj-veri' });
  });

  // Göster (K-062): dersin alanına git, sıradaki adımın yerini sarı halkayla ışıkla; adım yapılınca sıradakine geçer
  let isik = null;
  function kutuBul(h) {
    if (!h) return null;
    const ic = h.startsWith('iframe:'), sec_ = ic ? h.slice(7) : h;
    const f = ic ? ifr() : null, el = ic ? f?.contentDocument?.querySelector(sec_) : document.querySelector(sec_);
    const r = el?.getBoundingClientRect();
    if (!r || !r.width || !r.height) return null;
    if (!ic) return r;
    const fr = f.getBoundingClientRect();
    return { left: fr.left + r.left, top: fr.top + r.top, width: r.width, height: r.height, right: fr.left + r.right, bottom: fr.top + r.bottom };
  }
  function isikKapat() { if (!isik) return; cancelAnimationFrame(isik.kare); isik.kok.remove(); isik = null; }
  async function goster(d, i) {
    isikKapat();
    const st = await dersDurum(d);
    if (!st) return;
    if (i == null) { i = d.adimlar.findIndex((_, j) => !st.bitti.has(j)); if (i < 0) i = 0; }
    const a = d.adimlar[i], hedef = a.yer === false ? null : a.yer || `#/c/${st.ca}/${st.alan}/${a.git || 'yazi'}`;
    if (hedef && location.hash !== hedef) location.hash = hedef;
    let r = null;
    for (let k = 0; k < 40 && a.hedef && !(r = kutuBul(a.hedef)); k++) await new Promise((x) => setTimeout(x, 100));
    const kok = document.createElement('div');
    kok.id = 'ogIsik';
    kok.innerHTML = `<div class="og-halka"${r ? '' : ' hidden'}></div><div class="og-balon" role="status">${typeof kivSvg === 'function' ? kivSvg('normal', 30) : ''}
      <div><small>${DERSLER.indexOf(d) + 1}. ders · ${kacis(d.ad)} · adım ${i + 1}/${d.adimlar.length}</small><p>${kacis(a.metin)}</p></div><button type="button" data-og-kapat title="Kapat (Esc)">×</button></div>`;
    document.body.append(kok);
    isik = { kok, ders: d, i, kare: 0 };
    kok.querySelector('[data-og-kapat]').onclick = isikKapat;
    const yerlestir = () => {
      if (!isik || isik.kok !== kok) return;
      const k = kutuBul(a.hedef), h = kok.querySelector('.og-halka'), b = kok.querySelector('.og-balon'), W = innerWidth, H = innerHeight, p = 6;
      const bw = b.offsetWidth || 320, bh = b.offsetHeight || 70;
      if (k) {
        h.hidden = false;
        Object.assign(h.style, { left: k.left - p + 'px', top: k.top - p + 'px', width: k.width + 2 * p + 'px', height: k.height + 2 * p + 'px' });
        let x = k.left, yy = k.bottom + 16;
        if (yy + bh > H - 16) yy = k.top - bh - 16;
        if (yy < 16) [x, yy] = [k.right + 16 + bw < W - 16 ? k.right + 16 : k.left - 16 - bw, k.top];
        b.style.left = Math.max(16, Math.min(x, W - bw - 16)) + 'px'; b.style.top = Math.max(16, Math.min(yy, H - bh - 16)) + 'px';
      } else { h.hidden = true; b.style.left = (W - bw) / 2 + 'px'; b.style.top = '96px'; }
      isik.kare = requestAnimationFrame(yerlestir);
    };
    yerlestir();
  }

  // Çalışma alanı sayfası (pano ArayuzOgreticiT2, kâğıt K-070): yedi ders kartı ilerleme halkasıyla, altında seçili dersin adımları
  const TIK = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>';
  const halka = (d, y, t) => `<svg width="46" height="46" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" class="og-h0"/><circle cx="18" cy="18" r="15" class="og-h1" style="stroke:var(--r-${d.renk});stroke-dasharray:${((94.2 * y) / t).toFixed(1)} 94.2"/></svg>`;
  async function sayfaCiz(ca) {
    if (!ca) return;
    const durumlar = await Promise.all(DERSLER.map((d) => dersDurum(d, true)));
    if (yerOku().tur !== 'calisma' || yerOku().ca !== ca.id) return;
    const sayi = (n) => durumlar[n]?.bitti.size || 0, toplam = DERSLER.reduce((t, d) => t + d.adimlar.length, 0), yapilan = DERSLER.reduce((t, _, n) => t + sayi(n), 0);
    const ilkEksik = DERSLER.findIndex((d, n) => sayi(n) < d.adimlar.length);
    let secili = DERSLER.findIndex((d) => d.anahtar === depo.al('og:secili'));
    if (secili < 0) secili = Math.max(0, ilkEksik);
    const d = DERSLER[secili], st = durumlar[secili];
    const kart = (x, n) => { const y = sayi(n), t = x.adimlar.length, bitti = y === t;
      return `<button type="button" class="og-ders" data-og-ders="${n}" aria-pressed="${n === secili}"${durumlar[n] ? '' : ' disabled title="Bu dersin alanı yok"'}>
        <span class="og-ust" style="background:var(--r-${x.renk}-z)">${halka(x, y, t)}${bitti ? `<i class="og-tik" style="color:var(--r-${x.renk})">${TIK}</i>` : ''}</span>
        <span class="og-alt"><b>${kacis(x.ad)}</b><small>${y}/${t} adım${bitti ? ' · bitti' : ''}</small></span></button>`; };
    const adim = (a, i) => { const b = st?.bitti.has(i);
      return `<li class="${b ? 'bitti' : ''}"><span class="og-kutu"${b ? ` style="background:var(--r-${d.renk})"` : ''}>${b ? TIK : ''}</span><span>${kacis(a.metin)}</span></li>`; };
    // Kâğıt ve başlık kalıbı kabuktan (K-070: .sayfa, .sb); seçili dersin adımları kartların altında, aynı yaprakta
    $('#icerik').innerHTML = `<div class="sayfa og-sayfa">
      <div class="sb"><span class="sb-ik">${pxSvg(ca.ikon_px || PROGRAM_PX, ca.ikon_px ? renkOf(ca) : 'mor', 36)}</span><div class="sb-orta"><h1>${kacis(ca.ad)}</h1>
        <p class="sb-meta">${DERSLER.length} ders · ${yapilan}/${toplam} adım · her adım yaptığında kendiliğinden işaretlenir</p></div></div>
      <div class="og-serit"><i style="width:${Math.round((100 * yapilan) / toplam)}%"></i></div>
      <div class="og-izgara">${DERSLER.map(kart).join('')}</div>
      <section class="og-yan"><div><div class="og-etiket">DERS ${secili + 1} · ${kacis(d.ad.toLocaleUpperCase('tr'))}</div><h2>${kacis(d.baslik)}</h2><p>${kacis(d.ozet)}</p>
        <div class="og-dugmeler"><button type="button" class="ana" data-og-git="${secili}"${st ? '' : ' disabled'}>Derse git</button><button type="button" data-og-goster="${secili}"${st ? '' : ' disabled'}>Göster</button></div></div>
        <ul class="og-adimlar">${d.adimlar.map(adim).join('')}</ul></section></div>`;
  }
  document.addEventListener('click', (e) => {
    const k = e.target.closest('[data-og-ders]'), g = e.target.closest('[data-og-git]'), s = e.target.closest('[data-og-goster]');
    if (k) { depo.koy('og:secili', DERSLER[+k.dataset.ogDers].anahtar); sayfaCiz(caBul(yerOku().ca)); }
    if (g) { const st = durum.get(DERSLER[+g.dataset.ogGit].anahtar); if (st) location.hash = `#/c/${st.ca}/${st.alan}/yazi`; }
    if (s) goster(DERSLER[+s.dataset.ogGoster]);
  });

  // Kurulum (K-052, K-062): yedi ders alanı; var olan ders yeniden kurulmaz, kullanıcının verisine dokunulmaz.
  // secenek: ad (çalışma alanının adı), ek (alan adlarına ek; sınama için), ikonCiz (false: Codex ikon çizmez), git (false: gitme)
  async function ogreticiKur(secenek = {}) {
    const ad = secenek.ad || AD, ek = secenek.ek || '', ikon_ciz = secenek.ikonCiz !== false;
    const caBulAd = () => calisma.calisma_alanlari.find((c) => c.ad === ad);
    try {
      calisma = await al('/api/calisma');
      let ca = caBulAd();
      if (!ca) { await gonder('/api/calisma', { ad, izole: true, renk: 'mor', ikon_ciz, ogretici: true }); calisma = await al('/api/calisma'); ca = caBulAd(); }
      for (const [n, d] of DERSLER.entries()) {
        if (ca.alanlar.some((x) => dersOf(x) === d || x.ad === dersAlani(d, n, ek))) continue;
        const id = await gonder('/api/alan', { calisma: ca.id, ad: dersAlani(d, n, ek), ikon_ciz, ders: d.anahtar });
        const defter = await gonder('/api/alan-not', { alan: id });
        await gonder('/api/sayfa', { id: defter.id, govde: defterMd(d) });
        if (d.bilgi) { const b = await gonder('/api/alan-bilgi', { alan: id }); await gonder('/api/sayfa', { id: b.id, govde: d.bilgi.replace('DEFTER.md', defter.id + '.md') }); }
        for (const t of d.tuval || []) await gonder('/api/tuval-oge', { is: 'ekle', sayfa: 'page-' + id, ...t });
        calisma = await al('/api/calisma'); ca = caBulAd();
      }
      durum.clear();
      yanCiz();
      if (secenek.git !== false) location.hash = '#/c/' + ca.id;
      bildir(`${ad} hazır: ${DERSLER.length} ders, her birinde Dene listesi`);
      return ca.id;
    } catch (h) {
      bildir('Öğretici alan kurulamadı: ' + h.message);
      throw h;
    }
  }

  const stil = document.createElement('style');
  stil.textContent = `
.og-serit{height:6px;border-radius:99px;background:var(--yan-2);margin:20px 0 22px;overflow:hidden}.og-serit i{display:block;height:100%;border-radius:99px;background:var(--r-mor);transition:width .3s}
.og-izgara{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}
.og-ders{display:flex;flex-direction:column;padding:0;border:0;border-radius:12px;background:var(--kart);overflow:hidden;text-align:left;font:inherit;color:var(--yazi);cursor:pointer;
  box-shadow:0 0 0 1px var(--kenar);transition:box-shadow .15s}
.og-ders:hover{box-shadow:0 0 0 1px var(--kenar-3)}.og-ders[aria-pressed="true"]{box-shadow:0 0 0 2px var(--yazi)}
.og-ders:disabled{opacity:.5;cursor:default}.og-ders:focus{outline:none}.og-ders:focus-visible{box-shadow:0 0 0 2px var(--kart),0 0 0 4px var(--kenar-3)}
.og-ust{height:84px;display:grid;place-items:center;position:relative}.og-tik{position:absolute;right:10px;top:9px}
.og-h0{fill:none;stroke:var(--kart);stroke-width:4}.og-h1{fill:none;stroke-width:4;transform:rotate(-90deg);transform-origin:center;transition:stroke-dasharray .3s}
.og-alt{display:flex;flex-direction:column;gap:2px;padding:10px 12px}.og-alt b{font-size:14px}.og-alt small{font-size:12px;color:var(--soluk)}
.og-yan{display:grid;grid-template-columns:280px minmax(0,1fr);gap:32px;margin-top:28px;padding-top:24px;border-top:1px solid var(--kenar)}
.og-etiket{font:600 11px 'Geist Mono',monospace;letter-spacing:.06em;color:var(--soluk-2)}
.og-yan h2{margin:6px 0 0;font-size:18px}.og-yan>p{font-size:13.5px;line-height:1.55;color:var(--yazi-2);margin:6px 0 12px}
.og-adimlar{list-style:none;margin:0;padding:0}.og-adimlar li{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--kenar);font-size:14px;line-height:1.45}
.og-adimlar li:first-child{border-top:0;padding-top:2px}
.og-adimlar li.bitti{color:var(--soluk);text-decoration:line-through}
.og-kutu{width:18px;height:18px;border-radius:5px;flex:none;display:grid;place-items:center;margin-top:1px;color:var(--kart);box-shadow:inset 0 0 0 1.5px var(--kenar-3)}
.og-adimlar li.bitti .og-kutu{box-shadow:none}
.og-dugmeler{margin-top:12px;display:flex;gap:6px}.og-dugmeler button{height:34px;padding:0 12px;border:0;border-radius:8px;background:none;font:inherit;font-size:13px;color:var(--soluk);cursor:pointer}
.og-dugmeler button:hover{color:var(--yazi);background:var(--yan)}.og-dugmeler .ana,.og-dugmeler .ana:hover{background:var(--yazi);color:var(--kart)}
.og-dugmeler button:disabled{opacity:.5;cursor:default}
#ogIsik{position:fixed;inset:0;z-index:250;pointer-events:none}
.og-halka{position:fixed;border-radius:10px;box-shadow:0 0 0 3px var(--r-sari),0 0 0 9px color-mix(in srgb,var(--r-sari) 35%,transparent);animation:og-nabiz 1.4s ease-in-out infinite}
.og-balon{position:fixed;pointer-events:auto;display:flex;align-items:flex-start;gap:10px;width:min(340px,calc(100vw - 32px));box-sizing:border-box;padding:12px 12px 12px 14px;border-radius:14px;
  background:var(--kart);color:var(--yazi);box-shadow:0 0 0 1px var(--kenar),0 18px 50px -20px rgba(0,0,0,.5)}
.og-balon small{font-size:11.5px;color:var(--soluk-2)}.og-balon p{margin:2px 0 0;font-size:14px;line-height:1.45}.og-balon>div{flex:1;min-width:0}
.og-balon button{border:0;background:none;font-size:18px;line-height:1;color:var(--soluk);cursor:pointer;padding:0 2px}.og-balon button:hover{color:var(--yazi)}
@keyframes og-nabiz{50%{box-shadow:0 0 0 3px var(--r-sari),0 0 0 14px color-mix(in srgb,var(--r-sari) 18%,transparent)}}
@media (max-width:760px){.og-yan{grid-template-columns:1fr;gap:16px}}
@media (prefers-reduced-motion:reduce){.og-halka{animation:none}.og-serit i,.og-h1,.og-ders{transition:none}}`;
  document.head.append(stil);

  window.ogreticiKur = ogreticiKur;
  window.Ogretici = { DERSLER, ogreticiMi, sayfaCiz, goster: (anahtar, i) => goster(DERSLER.find((d) => d.anahtar === anahtar), i), durum: (anahtar) => dersDurum(DERSLER.find((d) => d.anahtar === anahtar), true) };
})();
