// Codex paneli: alanın Codex görevi. Geçmiş /api/codex/gecmis, canlı akış /api/codex/akis (SSE), gönder/cevap/dur POST.
// Konuşma öne çıkar: Codex'in işleri (düşünce, komut, dosya) tek satırlık adım, açılınca ayrıntı. Canlı durum akışın altında yazar.
(function () {
  const kacis = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Bağlantı: web adresi yeni sekmede açılır, repo içi yol (pano, not) yalnız adıyla gösterilir
  const bag = (_, metin, url) => (/^https?:/.test(url) ? `<a href="${url}" target="_blank" rel="noopener">${metin}</a>` : `<span class="cx-bag" title="${url}">${metin}</span>`);
  const satirIci = (s) => s.replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, bag);
  // Hafif markdown: paragraf, madde (-, *, 1.), **kalın**, `kod`
  const MADDE = /^\s*([-*]|\d+\.)\s+/;
  function bicim(s) {
    return kacis(s).trim().split(/\n{2,}/).map((blok) => {
      const satirlar = blok.split('\n');
      if (satirlar.every((l) => MADDE.test(l))) {
        const no = (satirlar[0].match(/^\s*(\d+)\./) || [])[1];
        const li = satirlar.map((l) => `<li>${satirIci(l.replace(MADDE, ''))}</li>`).join('');
        return no ? `<ol start="${no}">${li}</ol>` : `<ul>${li}</ul>`;
      }
      return `<p>${satirIci(satirlar.join('<br>'))}</p>`;
    }).join('');
  }
  const yolla = async (u, govde) => {
    const r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.hata || 'Codex işlemi yapılamadı');
    return d.sonuc;
  };
  const svg = (d) => `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const IKON = {
    Okudu: svg('<path d="M4 1.8h5l3 3v9.4H4z"/><path d="M9 1.8v3h3M6 8.5h4M6 11h4"/>'),
    Aradı: svg('<circle cx="7" cy="7" r="4.2"/><path d="m10.2 10.2 3.6 3.6"/>'),
    Çalıştırdı: svg('<path d="m3 4.5 3.5 3.5L3 11.5M8.5 12h4.5"/>'),
    Yazdı: svg('<path d="M10.5 2.5 13.5 5.5 6 13H3v-3z"/>'),
    Düşündü: svg('<path d="M8 2v2.2M8 11.8V14M2 8h2.2M11.8 8H14M3.8 3.8l1.5 1.5M10.7 10.7l1.5 1.5M3.8 12.2l1.5-1.5M10.7 5.3l1.5-1.5"/>'),
  };
  const GONDER = svg('<path d="M8 13V3M3.5 7.5 8 3l4.5 4.5"/>');
  const SARMAL = /^\/bin\/(?:z|ba)?sh\s+-l?c\s+(["'])([\s\S]*)\1$/;
  // Komutu insan diline çevirir: okuma, arama ya da çalıştırma; okunan dosyaların yalnız adı
  function komutOzet(komut) {
    const ic = (String(komut || '').match(SARMAL) || [])[2] ?? String(komut || '');
    const ilk = ic.trim().split(/\s+/)[0] || '';
    const fiil = /^(sed|cat|head|tail|nl|wc|less)$/.test(ilk) ? 'Okudu' : /^(rg|grep|find|ls|fd|tree)$/.test(ilk) ? 'Aradı' : 'Çalıştırdı';
    const dosyalar = [...new Set((ic.match(/[\w./-]+\.(?:md|json|html|css|js|mjs|py|txt)\b/g) || []).map((y) => y.split('/').pop()))];
    const ozet = fiil !== 'Çalıştırdı' && dosyalar.length ? dosyalar.slice(0, 3).join(', ') + (dosyalar.length > 3 ? ` +${dosyalar.length - 3}` : '') : ic;
    return { fiil, ic, ozet };
  }
  const sure = (sn) => (sn < 60 ? `${sn} sn` : `${Math.floor(sn / 60)} dk ${sn % 60} sn`);
  const ONERI = ['Bu alanı özetle', 'Notlardan bir pano çiz', 'Neyi atlıyorum?'];
  const KALEM = svg('<path d="M10.5 2.5 13.5 5.5 6 13H3v-3z"/><path d="m9 4 3 3"/>');
  const PANO = svg('<rect x="2.5" y="3" width="11" height="10" rx="1.5"/><path d="M2.5 6h11"/>');
  const EFOR = { low: 'Az', medium: 'Orta', high: 'Çok', xhigh: 'Çok fazla', max: 'En çok', ultra: 'Ultra' };
  const ETIKETLI = /^\s*<([a-z_]+)>/; // mesajın yanında giden bağlam blokları: kullanıcıya gösterilmez
  // Canlı çizim (K-077): Codex panoyu cevabının içinde <pano-yaz …>…</pano-yaz> bloğuyla verir. Sohbette blok görünmez, yerine
  // "Çiziyor / Çizdi <başlık>" satırı durur; içerik tuvalde akar.
  const PANO_BLOK = /<pano-yaz\b([^>]*)>[\s\S]*?(<\/pano-yaz>|$)/g;
  function panoAyir(ham) {
    const panolar = [];
    let duz = String(ham || '').replace(PANO_BLOK, (_, oz, kapanis) => { panolar.push({ ad: (oz.match(/baslik="([^"]*)"/) || oz.match(/ad="([^"]*)"/) || [, 'Pano'])[1], bitti: !!kapanis }); return '\n'; });
    const yarim = duz.match(/<[^<>]*$/);  // açılış etiketi yarım geldiyse yazı diye görünmesin
    if (yarim && ('<pano-yaz'.startsWith(yarim[0]) || yarim[0].startsWith('<pano-yaz'))) duz = duz.slice(0, yarim.index);
    return { duz: duz.trim(), panolar };
  }
  const depo = {
    al(k) { try { return JSON.parse(localStorage.getItem('beyin:' + k)); } catch { return null; } },
    koy(k, v) { try { localStorage.setItem('beyin:' + k, JSON.stringify(v)); } catch {} },
  };
  const BOS_DISARI = { baglam() {}, cizim() {}, yaz() {} };
  let kaynak = null, saat = null, modeller = null, disari = BOS_DISARI;

  function ac(kap, { alan, bildir, notOldu, hal, bos: bosYazi, sayfa }) {
    kapat();
    // Sayfanın Codex'i (alan sayfa-<id>): not iğnelemesi yok, boş hali sayfaya göre
    kap.innerHTML = `<div class="cx${alan.startsWith('sayfa-') ? ' cx-sayfa' : ''}">
      <div class="cx-akis" id="cxAkis"></div>
      <div class="cx-yaz"><div class="cx-baglam" id="cxBaglam" hidden></div><textarea id="cxMetin" rows="1"></textarea>
        <div class="cx-yaz-alt">
          <div class="cx-model-kap"><button type="button" class="cx-arac cx-model" id="cxModel" title="Model, düşünme ve internet">Model</button><div class="cx-menu" id="cxMenu" hidden></div></div>
          <button type="button" class="cx-arac cx-ciz" id="cxCiz" aria-pressed="false" title="Çizim modu: Codex her mesajda konuşulanı panoya çizer, sormadan">${KALEM}<span>Çiz</span></button>
          <span class="cx-hal"><span class="cx-nokta" id="cxNokta"></span><span id="cxDurum">Bağlanıyor…</span></span>
          <button type="button" class="cx-gonder" id="cxGonder" aria-label="Gönder" title="Gönder (⏎) · satır için ⇧⏎">${GONDER}</button></div></div>
    </div>`;
    const akis = kap.querySelector('#cxAkis'), metin = kap.querySelector('#cxMetin');
    const canli = document.createElement('div');
    canli.className = 'cx-canli'; canli.hidden = true;
    canli.innerHTML = '<span class="cx-isik"></span><span class="cx-canli-yazi"></span><span class="cx-sure"></span><button type="button" class="cx-dur">Dur</button>';
    akis.appendChild(canli);
    let thread = null, bekliyor = false, kok = '', basla = 0, is = 'Düşünüyor';
    let model = depo.al('model'), efor = depo.al('efor'), ciz = !!depo.al('cizim'), baglamVeri = null, eylemVeri = null, liste = [];
    let internet = depo.al('internet') !== false;  // varsayılan açık (K-026): link ve video okunur
    const goreli = (y) => (kok && String(y).startsWith(kok + '/') ? String(y).slice(kok.length + 1) : String(y));
    const parca = new Map();
    const durum = (yazi, renk) => { kap.querySelector('#cxDurum').textContent = yazi; kap.querySelector('#cxNokta').style.background = renk; };
    const asagi = () => { akis.scrollTop = akis.scrollHeight; };
    const ekle = (el) => { akis.insertBefore(el, canli); };

    // Canlı satır: Codex çalışırken son mesajın altında ne yaptığı ve geçen süre
    function canliCiz() {
      canli.querySelector('.cx-canli-yazi').textContent = is;
      canli.querySelector('.cx-sure').textContent = basla ? sure(Math.max(0, Math.round((Date.now() - basla) / 1000))) : '';
    }
    function calisiyor(evet) {
      canli.hidden = !evet;
      clearInterval(saat); saat = null;
      if (evet) { basla = basla || Date.now(); is = is || 'Düşünüyor'; canliCiz(); saat = setInterval(canliCiz, 1000); asagi(); }
      else basla = 0;
      durum(evet ? 'Çalışıyor' : 'Hazır', evet ? 'var(--karar)' : 'var(--ilke)');
      haber();
    }
    let ayrinti = '';  // şu anki işin nesnesi: okunan dosya, yazılan pano (baloncuk ve tuval gösterir)
    const haber = () => { if (hal) hal({ calisiyor: !canli.hidden, is, ciz, ayrinti }); };
    const isYap = (yazi, ne = '') => { is = yazi; ayrinti = ne; canli.classList.toggle('cx-bekle', yazi === 'Senin cevabını bekliyor'); canliCiz(); haber(); };
    // Süren adım şimdiki zamanla ve parıltıyla yazılır, bitince geçmiş zamana döner (K-034)
    const SIMDI = { Okudu: 'Okuyor', Aradı: 'Arıyor', Çalıştırdı: 'Çalıştırıyor', Yazdı: 'Yazıyor', Düşündü: 'Düşünüyor' };

    function adim(el, fiil, ozet, isaret, ayrinti, suruyor = false) {
      const acik = el.querySelector('details')?.open;
      el.className = 'cx-adim' + (suruyor ? ' cx-suruyor' : '');
      el.dataset.adimFiil = fiil; el.dataset.adimOzet = ozet;
      el.innerHTML = `<details${acik ? ' open' : ''}><summary><span class="cx-ikon">${IKON[fiil] || ''}</span><b>${suruyor ? SIMDI[fiil] || fiil : fiil}</b><span class="cx-ozet">${kacis(ozet)}</span>${isaret}</summary>${ayrinti ? `<div class="cx-ayrinti">${ayrinti}</div>` : ''}</details>`;
    }
    const isaretle = (bitti, basarili, kod) => (!bitti ? '<span class="cx-don"></span>' : basarili ? '' : `<span class="cx-hata">✕ ${kacis(kod ?? '')}</span>`);

    // Adımlar tek satırda toplanır (K-073): art arda biten adımlar "Okudu x · 3 adım" satırı olur, basınca açılır; süren adım hep görünür
    const ADIM = new Set(['reasoning', 'commandExecution', 'fileChange']), ONCELIK = ['Yazdı', 'Okudu', 'Aradı', 'Çalıştırdı', 'Düşündü'];
    function grupAl() {
      const son = canli.previousElementSibling;
      if (son?.classList.contains('cx-grup')) return son;
      const g = document.createElement('div'); g.className = 'cx-grup';
      g.innerHTML = '<button type="button" class="cx-grup-bas" aria-expanded="false" hidden></button><div class="cx-grup-ic"></div>';
      ekle(g); return g;
    }
    function grupCiz(g) {
      const bas = g.firstElementChild, ic = g.lastElementChild;
      if (!ic.children.length) return void g.remove();
      const adimlar = [...ic.children].filter((a) => !a.hidden && a.classList.contains('cx-adim')), biten = adimlar.filter((a) => !a.classList.contains('cx-suruyor'));
      const toplu = biten.length > 1;
      // Ayrıntısı açık bir adım okunurken satırlar toplanırsa okunan kaybolmasın: grup açık başlar
      if (toplu && !g.classList.contains('cx-toplu') && biten.some((a) => a.querySelector('details')?.open)) g.classList.add('cx-acik');
      g.hidden = !adimlar.length; bas.hidden = !toplu; g.classList.toggle('cx-toplu', toplu);
      if (!toplu) return;
      const fiil = ONCELIK.find((f) => biten.some((a) => a.dataset.adimFiil === f)) || biten[0].dataset.adimFiil, ayni = biten.filter((a) => a.dataset.adimFiil === fiil);
      let ozet = ayni.at(-1).dataset.adimOzet;
      if (fiil === 'Yazdı' || fiil === 'Okudu') {  // dosya adları birleşir: ilk ikisi yazılır, kalanı sayıyla
        let fazla = 0;
        const adlar = [...new Set(ayni.flatMap((a) => a.dataset.adimOzet.replace(/ \+(\d+)$/, (_, n) => { fazla += +n; return ''; }).split(', ')))];
        ozet = adlar.slice(0, 2).join(', ') + (adlar.length + fazla > 2 ? ` +${adlar.length + fazla - 2}` : '');
      }
      bas.setAttribute('aria-expanded', String(g.classList.contains('cx-acik')));
      bas.innerHTML = `<span class="cx-ikon">${IKON[fiil] || ''}</span><b>${fiil}</b><span class="cx-ozet">${kacis(ozet)}</span><span class="cx-say">${biten.length} adım</span>`;
    }
    // Uzun mesaj dört satırda katlanır (K-073): ölçü bölme görünürken alınır, bölmenin eni değişince yenilenir
    function kisalt(el) {
      const m = el.querySelector('.cx-sen-metin');
      if (!m || !m.offsetParent) return;
      el.classList.remove('cx-kisik');
      const fazla = Math.round(m.scrollHeight / (parseFloat(getComputedStyle(m).lineHeight) || 21)) - 4;
      let d = el.querySelector('.cx-devam');
      if (fazla < 2) return void d?.remove();  // bir satır için düğme açılmaz
      if (!d) { d = document.createElement('button'); d.type = 'button'; d.className = 'cx-devam'; m.after(d); }
      const acik = el.classList.contains('cx-acik');
      el.classList.toggle('cx-kisik', !acik);
      d.textContent = acik ? 'Daha az göster' : `Devamını göster · ${fazla} satır`;
    }
    let akisEn = 0, sonCizim = false;
    new ResizeObserver(() => { const en = akis.clientWidth; if (en === akisEn) return; akisEn = en; akis.querySelectorAll('.cx-sen').forEach(kisalt); }).observe(akis);

    function parcaCiz(p, bitti) {
      const grup = ADIM.has(p.type) ? parca.get(p.id)?.closest('.cx-grup') || grupAl() : null;
      parcaYaz(p, bitti, grup);
      if (grup) grupCiz(grup);
    }
    function parcaYaz(p, bitti, grup) {
      let el = parca.get(p.id);
      const yeni = !el;
      if (yeni) { el = document.createElement('div'); parca.set(p.id, el); if (grup) grup.lastElementChild.appendChild(el); else ekle(el); }
      if (p.type === 'userMessage') {
        const ogeler = (p.content || []).map((c) => c.text || '');
        const etiket = ogeler.map((t) => (t.match(ETIKETLI) || [])[1]).filter(Boolean);
        const panoAdlari = [...(ogeler.find((t) => /^\s*<pano>/.test(t)) || '').matchAll(/panolar\/([^\s"]+)\.dc\.html/g)].map((m) => m[1]);
        // Çizim modu her mesajın altında yazmaz (K-073): yalnız açıldığı ve kapandığı yerde ince bir ayraç
        const cizim = etiket.includes('cizim_modu');
        if (yeni && cizim !== sonCizim) {
          const a = document.createElement('div'); a.className = 'cx-ayrac'; a.innerHTML = `<span>${KALEM}Çizim modu ${cizim ? 'açıldı' : 'kapandı'}</span>`;
          akis.insertBefore(a, el);
        }
        if (yeni) sonCizim = cizim;
        const cipler = [panoAdlari.length && PANO + kacis(panoAdlari.length > 1 ? panoAdlari.length + ' pano' : panoAdlari[0]), etiket.includes('bolge') && PANO + 'Bölge'].filter(Boolean);
        el.className = 'cx-sen' + (el.classList.contains('cx-acik') ? ' cx-acik' : '');
        el.innerHTML = `<div class="cx-sen-metin">${bicim(ogeler.filter((t) => !ETIKETLI.test(t)).join('\n'))}</div>` + (cipler.length ? `<div class="cx-sen-cip">${cipler.map((c) => `<span>${c}</span>`).join('')}</div>` : '');
        kisalt(el);
      } else if (p.type === 'agentMessage') {
        const ham = p.text ?? el.dataset.ham ?? '', { duz, panolar } = panoAyir(ham);
        if (bitti && !duz && !panolar.length) { el.remove(); parca.delete(p.id); return; }
        el.className = 'cx-codex'; el.dataset.ham = ham; el.dataset.metin = duz;
        el.innerHTML = panolar.map((x) => `<div class="cx-pano-cip${x.bitti || bitti ? '' : ' cx-suruyor'}"><span class="cx-ikon">${KALEM}</span><b>${x.bitti || bitti ? 'Çizdi' : 'Çiziyor'}</b><span class="cx-ozet">${kacis(x.ad)}</span></div>`).join('')
          + `<div class="cx-metin">${bicim(duz)}</div>` + (bitti && duz ? '<div class="cx-eylem cx-ignele"><span>İğnele</span><button type="button" class="cx-cip" data-ignele="karar">Karar</button><button type="button" class="cx-cip" data-ignele="soru">Soru</button><button type="button" class="cx-cip cx-mesaj-ciz" data-mesaj-ciz title="Bu cevabı panoya çiz">' + KALEM + 'Çiz</button></div>' : '');
      } else if (p.type === 'reasoning') {
        const ozet = (p.summary || []).map((s) => (typeof s === 'string' ? s : s.text || '')).join(' ').trim() || el.dataset.ozet || '';
        el.dataset.ozet = ozet;
        if (!ozet) { if (bitti) { el.remove(); parca.delete(p.id); } else el.hidden = true; return; }
        el.hidden = false;
        adim(el, 'Düşündü', ozet.replace(/\*\*/g, '').split('\n')[0], isaretle(bitti, true), `<div class="cx-dusunce">${bicim(ozet)}</div>`, !bitti);
      } else if (p.type === 'commandExecution') {
        el.dataset.cikti = p.aggregatedOutput ?? el.dataset.cikti ?? '';
        const k = komutOzet(p.command), cikti = el.dataset.cikti.split('\n').filter(Boolean).slice(-12).join('\n');
        adim(el, k.fiil, k.ozet, isaretle(bitti, p.exitCode === 0, p.exitCode), `<pre class="cx-kod">$ ${kacis(k.ic)}</pre>${cikti ? `<pre class="cx-cikti">${kacis(cikti)}</pre>` : ''}`, !bitti);
      } else if (p.type === 'fileChange') {
        const yollar = (p.changes || []).map((c) => goreli(c.path || ''));
        el.dataset.yollar = yollar.join('\n');
        adim(el, 'Yazdı', yollar.map((y) => y.split('/').pop()).join(', ') || '…', isaretle(p.status !== 'inProgress' && bitti, p.status !== 'failed' && p.status !== 'declined', p.status), yollar.length ? `<pre class="cx-kod">${kacis(yollar.join('\n'))}</pre>` : '', !(p.status !== 'inProgress' && bitti));
      } else {
        el.remove(); parca.delete(p.id); return;
      }
      if (yeni) asagi();
    }

    function istekCiz(r) {
      const id = 'istek:' + r.istekId;
      if (parca.has(id)) return;
      const el = document.createElement('div'); el.className = 'cx-kart'; parca.set(id, el); ekle(el);
      const cevap = async (sonuc) => { try { await yolla('/api/codex/cevap', { istekId: r.istekId, sonuc }); isYap('Düşünüyor'); } catch (e) { bildir(e.message); } };
      if (r.tur === 'item/tool/requestUserInput') {
        const secim = {};
        el.innerHTML = `<div class="cx-kart-bas">Codex soruyor</div>${(r.questions || []).map((q) => `<div class="cx-soru"><span>${kacis(q.question)}</span>
          <div>${(q.options || []).map((o) => `<button type="button" class="cx-cip" data-q="${kacis(q.id)}" data-o="${kacis(o.label)}" title="${kacis(o.description || '')}">${kacis(o.label)}</button>`).join('')}</div>
          ${q.isOther || !(q.options || []).length ? `<input class="satirgir" data-q-yaz="${kacis(q.id)}" placeholder="ya da yaz…">` : ''}</div>`).join('')}
          <div class="cx-eylem"><button type="button" class="ana-dugme" data-gonder>Cevapla</button></div>`;
        el.onclick = (e) => {
          const o = e.target.closest('[data-o]');
          if (o) { secim[o.dataset.q] = o.dataset.o; el.querySelectorAll(`[data-q="${CSS.escape(o.dataset.q)}"]`).forEach((b) => b.setAttribute('aria-pressed', String(b === o))); }
          if (e.target.closest('[data-gonder]')) {
            el.querySelectorAll('[data-q-yaz]').forEach((i) => { if (i.value.trim()) secim[i.dataset.qYaz] = i.value.trim(); });
            cevap({ answers: Object.fromEntries(Object.entries(secim).map(([q, a]) => [q, { answers: [a] }])) });
          }
        };
      } else {
        const komut = r.tur.includes('commandExecution') || r.tur === 'execCommandApproval';
        const ne = komut ? 'Komut için izin istiyor' : r.tur.includes('fileChange') || r.tur === 'applyPatchApproval' ? 'Dosya yazmak istiyor' : 'İzin istiyor';
        // Dosya onayı yolu taşımaz: aynı itemId'li dosya değişikliği parçası hemen önce gelir, oradan alınır
        const yollar = parca.get(r.itemId)?.dataset.yollar || '';
        const k = r.command ? komutOzet(Array.isArray(r.command) ? r.command.join(' ') : r.command).ic : '';
        el.innerHTML = `<div class="cx-kart-bas">${ne}</div>${r.reason ? `<span>${kacis(r.reason)}</span>` : ''}${yollar ? `<pre>${kacis(yollar)}</pre>` : ''}
          ${k ? `<pre>$ ${kacis(k)}</pre>` : ''}${r.grantRoot ? `<pre>${kacis(r.grantRoot)}</pre>` : ''}
          <div class="cx-eylem"><button type="button" class="ana-dugme" data-k="accept">İzin ver</button><button type="button" class="ikincil" data-k="acceptForSession">Bu görevde hep</button><span class="dol"></span><button type="button" class="ikincil cx-reddet" data-k="decline">Reddet</button></div>`;
        el.onclick = (e) => { const b = e.target.closest('[data-k]'); if (b) cevap({ decision: b.dataset.k }); };
        el.classList.add('cx-onay');
      }
      isYap('Senin cevabını bekliyor');
      asagi();
    }

    const IS = { reasoning: 'Düşünüyor', agentMessage: 'Yazıyor', fileChange: 'Dosya yazıyor' };
    function olay(o) {
      const p = o.params || {};
      if (o.method === 'beyin/kapandi') { calisiyor(false); durum('Codex kapandı · yazınca yeniden başlar', 'var(--tehlike)'); return; }
      if (o.method === 'item/completed' && p.item?.type === 'fileChange' && p.threadId === thread && hal) hal({ calisiyor: true, is, ciz, yazdi: (p.item.changes || []).map((c) => goreli(c.path || '')) });
      if (p.threadId && !thread && bekliyor) thread = p.threadId;
      if (!p.threadId || p.threadId !== thread) { if (o.method === 'beyin/istek-kapandi') { const el = parca.get('istek:' + p.istekId); if (el) { el.remove(); parca.delete('istek:' + p.istekId); } } return; }
      if (o.method === 'turn/started') { is = 'Düşünüyor'; calisiyor(true); }
      else if (o.method === 'turn/completed') { calisiyor(false); bekliyor = false; }
      else if (o.method === 'item/started') {
        parcaCiz(p.item, false);
        const k = p.item.type === 'commandExecution' && komutOzet(p.item.command);
        const ne = k ? (k.fiil !== 'Çalıştırdı' ? k.ozet : '') : p.item.type === 'fileChange' ? (p.item.changes || []).map((c) => goreli(c.path || '').split('/').pop()).join(', ') : '';
        isYap(k ? { Okudu: 'Okuyor', Aradı: 'Arıyor' }[k.fiil] || 'Komut çalıştırıyor' : IS[p.item.type] || 'Düşünüyor', ne);
      }
      else if (o.method === 'item/completed') { parcaCiz(p.item, true); if (is !== 'Senin cevabını bekliyor') isYap('Düşünüyor'); }
      else if (o.method === 'item/agentMessage/delta') { const el = parca.get(p.itemId); if (el) { el.dataset.ham = (el.dataset.ham || '') + p.delta; parcaCiz({ id: p.itemId, type: 'agentMessage' }, false); asagi(); } }
      // Canlı çizim (K-077): pano içeriği parça parça tuvale gider; blok kapanınca pano yazılmış sayılır
      else if (o.method === 'beyin/pano-akis') { if (p.basla) isYap('Çiziyor', p.ad); if (hal) hal({ calisiyor: !canli.hidden, is, ciz, ayrinti, panoAkis: p, ...(p.bitti ? { yazdi: ['panolar/' + p.ad] } : {}) }); }
      else if (o.method === 'item/reasoning/summaryTextDelta') { const el = parca.get(p.itemId); if (el) { el.dataset.ozet = (el.dataset.ozet || '') + p.delta; parcaCiz({ id: p.itemId, type: 'reasoning' }, false); } }
      else if (o.method === 'item/commandExecution/outputDelta') { const el = parca.get(p.itemId); if (el) el.dataset.cikti = (el.dataset.cikti || '') + p.delta; }
      else if (o.method === 'beyin/istek') istekCiz(p);
    }

    const boyla = () => { metin.style.height = 'auto'; metin.style.height = Math.min(metin.scrollHeight, 180) + 'px'; };
    async function gonder() {
      const yazi = metin.value.trim();
      if (!yazi) return;
      metin.value = ''; boyla(); bekliyor = true;
      akis.querySelector('.cx-bos')?.remove();
      is = 'Gönderiliyor'; calisiyor(true);
      const govde = { alan, metin: yazi, model, efor, internet, ciz, sayfa, panolar: baglamVeri?.panolar || [], bolge: baglamVeri?.bolge || null, eylem: eylemVeri }; // sayfa: açık not, Codex onu da okur
      baglamYap(null); eylemVeri = null;
      try { const s = await yolla('/api/codex/gonder', govde); thread = s.thread; }
      catch (e) { bekliyor = false; metin.value = yazi; boyla(); calisiyor(false); durum('Gönderilemedi', 'var(--tehlike)'); bildir(e.message); }
    }
    // Model ve düşünme: liste Codex'ten bir kez gelir, seçim hatırlanır
    const modelDugme = kap.querySelector('#cxModel'), menu = kap.querySelector('#cxMenu');
    // Düğmede bir bakışta: model, düşünme çubukları (seviye kadar dolu) ve internet (K-036)
    const KURE = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="5.8"/><path d="M2.4 8h11.2M8 2.2c1.7 1.6 2.5 3.5 2.5 5.8S9.7 12.2 8 13.8M8 2.2C6.3 3.8 5.5 5.7 5.5 8s.8 4.2 2.5 5.8"/></svg>';
    // Seçici (K-044): üstte seviyenin adı seviye renginde, altında model adı (basınca liste), ışıltılı kaydırıcı, internet
    const SIMSEK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M9 1.8 3.5 9h4l-1 5.2L12.5 7h-4z"/></svg>';
    const GERI = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2.8 8a5.2 5.2 0 1 0 1.6-3.8"/><path d="M2.6 2.4v2.8h2.8"/></svg>';
    const OK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 4l4 4-4 4"/></svg>';
    // Seviye rengi: en düşük mavi, sonra lacivertten mora
    const seviyeRengi = (m, e) => { const n = m.eforlar.length, i = Math.max(0, m.eforlar.indexOf(e)); return i === 0 ? 'var(--r-mavi)' : n <= 2 ? 'var(--kaynak)' : `color-mix(in srgb, var(--kaynak) ${Math.round(((i - 1) / (n - 2)) * 100)}%, var(--yol))`; };
    const kisaAd = (ad) => { const p = String(ad).split('-'); return p.length > 1 && /[a-zğüşöçı]/i.test(p[p.length - 1]) && !/^\d/.test(p[p.length - 1]) ? p[p.length - 1] : ad; };
    // Yıldızlar seviyeyle çoğalır: ilk iki seviye düz renk, sonra her seviyede altı yıldız daha (uzay)
    const isiltilar = (n) => Array.from({ length: n }, (_, i) => `<i class="${i % 4 ? '' : 'b'}" style="left:${(i * 37) % 97}%;top:${15 + ((i * 53) % 70)}%;animation-delay:${((i * 0.29) % 1.8).toFixed(2)}s"></i>`).join('');
    let listeAcik = false;
    function rayYeri(m) { const n = m.eforlar.length, i = Math.max(0, m.eforlar.indexOf(efor)); return n > 1 ? i / (n - 1) : 1; }
    function modelCiz() {
      const m = liste.find((x) => x.id === model);
      const renk = m ? seviyeRengi(m, efor) : 'var(--yol)', ad = EFOR[efor] || efor;
      modelDugme.innerHTML = m ? `<span class="cx-model-ad">${kacis(kisaAd(m.ad))} · <b class="cx-model-sev" style="color:${renk}">${kacis(ad)}</b></span><span class="cx-kure${internet ? ' acik' : ''}" title="İnternet ${internet ? 'açık' : 'kapalı'}">${KURE}</span>` : 'Model';
      modelDugme.title = m ? `${m.ad} · düşünme: ${ad} · internet ${internet ? 'açık' : 'kapalı'}` : 'Model';
      if (!m) { menu.innerHTML = ''; return; }
      const t = rayYeri(m), seviye = Math.max(0, m.eforlar.indexOf(efor));
      menu.innerHTML = `<div class="cx-ds-bas"><button type="button" data-efor="${kacis(m.eforlar[0])}" title="Hızlı: ${kacis(EFOR[m.eforlar[0]] || m.eforlar[0])}">${SIMSEK}</button>
        <span class="cx-ds-sev" style="color:${renk}">${kacis(ad)}</span><button type="button" data-efor="${kacis(m.varsayilanEfor)}" title="Varsayılana dön: ${kacis(EFOR[m.varsayilanEfor] || m.varsayilanEfor)}">${GERI}</button></div>
        <button type="button" class="cx-ds-mod" data-liste aria-expanded="${listeAcik}">${kacis(m.ad)}${OK}</button>
        ${listeAcik ? `<div class="cx-ds-liste">${liste.map((x) => `<button type="button" class="cx-menu-oge" data-model="${kacis(x.id)}" aria-checked="${x.id === model}" title="${kacis(x.aciklama || '')}"><b>${kacis(x.ad)}${x.varsayilan ? ' <i>varsayılan</i>' : ''}</b></button>`).join('')}</div>` : ''}
        <div class="cx-ds-ray${seviye >= m.eforlar.length - 2 && seviye >= 3 ? ' uzay' : ''}" data-ray role="slider" aria-label="Düşünme" aria-valuetext="${kacis(ad)}" tabindex="0" style="--renk:${renk}">
          <div class="cx-ds-dolu" style="width:calc(24px + (100% - 24px) * ${t.toFixed(3)})"><span>${isiltilar(Math.max(0, seviye - 1) * 6)}</span></div><span class="cx-ds-top" style="left:calc(2px + (100% - 24px) * ${t.toFixed(3)})"></span></div>
        <button type="button" class="cx-ds-ic" data-internet role="switch" aria-checked="${internet}" title="${internet ? 'Açık: link, YouTube ve web kaynakları okunur' : 'Kapalı: yalnız bu bilgisayardaki dosyalar'}"><span class="cx-kure${internet ? ' acik' : ''}">${KURE}</span>İnternet<span class="anahtar"></span></button>`;
    }
    function modelSec(id, yeniEfor) {
      const m = liste.find((x) => x.id === id) || liste.find((x) => x.varsayilan) || liste[0];
      if (!m) return;
      model = m.id; efor = m.eforlar.includes(yeniEfor) ? yeniEfor : m.eforlar.includes(efor) ? efor : m.varsayilanEfor;
      depo.koy('model', model); depo.koy('efor', efor); modelCiz();
    }
    modeller = modeller || fetch('/api/codex/modeller', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])).catch(() => []);
    modeller.then((l) => { liste = Array.isArray(l) ? l : []; modelSec(model, efor); });
    modelDugme.onclick = () => { menu.hidden = !menu.hidden; listeAcik = false; modelCiz(); };
    menu.onclick = (e) => {
      const m = e.target.closest('[data-model]'), f = e.target.closest('[data-efor]'), n = e.target.closest('[data-internet]'), l = e.target.closest('[data-liste]');
      if (m) { listeAcik = false; modelSec(m.dataset.model, efor); }
      if (f) modelSec(model, f.dataset.efor);
      if (l) { listeAcik = !listeAcik; modelCiz(); }
      if (n) { internet = !internet; depo.koy('internet', internet); modelCiz(); }
    };
    // Kaydırıcı: tıkla ya da sürükle; en yakın seviyeye oturur
    const rayaGore = (ray, x) => {
      const m = liste.find((y) => y.id === model); if (!m) return;
      const r = ray.getBoundingClientRect(), n = m.eforlar.length;
      const i = Math.round(Math.min(1, Math.max(0, (x - r.left - 12) / Math.max(1, r.width - 24))) * (n - 1));
      if (m.eforlar[i] !== efor) modelSec(model, m.eforlar[i]);
    };
    menu.addEventListener('pointerdown', (e) => {
      const ray = e.target.closest('[data-ray]'); if (!ray) return;
      e.preventDefault(); rayaGore(ray, e.clientX);
      const tasi = (ev) => { const r = menu.querySelector('[data-ray]'); r.classList.add('suruk'); rayaGore(r, ev.clientX); };
      const birak = () => { removeEventListener('pointermove', tasi); removeEventListener('pointerup', birak); menu.querySelector('[data-ray]')?.classList.remove('suruk'); };
      addEventListener('pointermove', tasi); addEventListener('pointerup', birak);
    });
    menu.addEventListener('keydown', (e) => {
      if (!e.target.closest('[data-ray]') || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const m = liste.find((y) => y.id === model); if (!m) return;
      const i = Math.min(m.eforlar.length - 1, Math.max(0, m.eforlar.indexOf(efor) + (e.key === 'ArrowRight' ? 1 : -1)));
      e.preventDefault(); modelSec(model, m.eforlar[i]); menu.querySelector('[data-ray]')?.focus();
    });
    // Yol olay anında okunur: kaydırıcı basınca seçiciyi yeniden çizer, hedef ağaçtan kopsa da menü açık kalır
    kap.addEventListener('pointerdown', (e) => { if (!menu.hidden && !e.composedPath().some((n) => n.classList?.contains('cx-model-kap'))) menu.hidden = true; });
    // Çizim modu: açıkken Codex her mesajda konuşulanı panoya çizer, sormadan
    const cizDugme = kap.querySelector('#cxCiz');
    function cizYap(v) {
      ciz = !!v; depo.koy('cizim', ciz);
      cizDugme.setAttribute('aria-pressed', String(ciz));
      metin.placeholder = ciz ? 'Anlat, Codex çizerek cevaplasın… (⏎ gönder)' : "Codex'e yaz… (⏎ gönder, ⇧⏎ satır)";
      haber();
    }
    cizDugme.onclick = () => cizYap(!ciz);
    cizYap(ciz);
    // Tuvalde seçilen panolar ya da boş bölge: bir sonraki mesajın bağlamı
    const baglamKap = kap.querySelector('#cxBaglam');
    function baglamYap(b) {
      baglamVeri = b && ((b.panolar || []).length || b.bolge) ? b : null;
      baglamKap.hidden = !baglamVeri;
      baglamKap.innerHTML = baglamVeri ? `<span class="cx-baglam-cip">${PANO}<span>${kacis(baglamVeri.baslik || '')}</span><button type="button" aria-label="Bağlamı kaldır" data-baglam-sil>×</button></span>` : '';
    }
    baglamKap.onclick = (e) => { if (e.target.closest('[data-baglam-sil]')) baglamYap(null); };
    disari = { baglam(b) { baglamYap(b); metin.focus(); }, cizim(v) { cizYap(v ?? !ciz); },
      // Tek seferlik mesaj: çizim modu yalnız bu mesaj için (düğme değişmez; gonder ciz'i eşzamanlı okur)
      // Tek seferlik mesaj: çizim modu ve internet o tur için verilebilir (veri yorumu linke ve videoya ulaşsın diye interneti açar)
      // Tuvaldeki hızlı eylem: seçili panolar bağlam olur, eylem verisi (<pano_eylemi>) sunucuda isteme döner
      yaz(m, cizimle, secenek = {}) {
        const eskiC = ciz, eskiI = internet;
        if (cizimle !== undefined) ciz = !!cizimle;
        if (secenek.internet !== undefined) internet = !!secenek.internet;
        if (secenek.baglam) baglamYap(secenek.baglam);
        eylemVeri = secenek.eylem || null;
        metin.value = m; gonder(); ciz = eskiC; internet = eskiI;
      } };

    kap.querySelector('#cxGonder').onclick = gonder;
    metin.addEventListener('input', boyla);
    metin.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); gonder(); } });
    canli.querySelector('.cx-dur').onclick = () => yolla('/api/codex/dur', { alan }).catch((e) => bildir(e.message));
    akis.addEventListener('click', async (e) => {
      const gb = e.target.closest('.cx-grup-bas'), dv = e.target.closest('.cx-devam');
      if (gb) { gb.setAttribute('aria-expanded', String(gb.parentElement.classList.toggle('cx-acik'))); return; }
      if (dv) { const b = dv.closest('.cx-sen'); b.classList.toggle('cx-acik'); kisalt(b); b.scrollIntoView({ block: 'nearest' }); return; }
      const o = e.target.closest('[data-oneri]');
      if (o) { metin.value = o.textContent; gonder(); return; }
      // Tek tık görsel (K-007, K-075): cevabı bu alanın Codex'i çizer; çizim modu yalnız bu mesaj için
      const mc = e.target.closest('[data-mesaj-ciz]');
      if (mc) { const m = (mc.closest('.cx-codex').dataset.metin || '').replace(/\s+/g, ' ').trim(); disari.yaz(`Şu cevabını bir panoya çiz: "${m.slice(0, 160)}${m.length > 160 ? '…' : ''}"`, true); return; }
      const b = e.target.closest('[data-ignele]');
      if (!b) return;
      const metni = b.closest('.cx-codex').dataset.metin || '';
      try { const no = await yolla('/api/not', { alan, tur: b.dataset.ignele, metin: metni, veren: 'codex', kaynak: 'Codex görevi' }); bildir(no + ' oldu: konusuz, panelde'); notOldu && notOldu(no); }
      catch (er) { bildir(er.message); }
    });

    fetch('/api/codex/gecmis?alan=' + encodeURIComponent(alan), { cache: 'no-store' }).then(async (r) => {
      const g = await r.json();
      if (!r.ok) throw new Error(g.hata || 'Codex açılamadı');
      thread = g.thread; kok = g.kok || '';
      for (const t of g.turlar || []) for (const p of t.parcalar) parcaCiz(p, true);
      if (!thread) {
        const bos = document.createElement('div'); bos.className = 'cx-bos';
        bos.innerHTML = `<div class="cx-bos-ikon${typeof kivSvg === 'function' ? ' kiv-bos' : ''}">${typeof kivSvg === 'function' ? kivSvg('normal', 48) : IKON.Düşündü}</div><b>${kacis(bosYazi?.baslik || 'Bu alanda yanındayım')}</b><span>${kacis(bosYazi?.metin || '')}</span>
          <div class="cx-eylem">${(bosYazi?.oneriler || ONERI).map((o) => `<button type="button" class="cx-cip" data-oneri>${o}</button>`).join('')}</div>`;
        ekle(bos);
      }
      for (const r_ of g.istekler || []) istekCiz(r_);
      calisiyor(!!g.calisiyor);
      if ((g.istekler || []).length) isYap('Senin cevabını bekliyor');
      kaynak = new EventSource('/api/codex/akis?son=' + (g.sira || 0));
      kaynak.onmessage = (e) => { try { olay(JSON.parse(e.data)); } catch {} };
      asagi();
    }).catch((e) => { durum('Codex açılamadı', 'var(--tehlike)'); akis.insertAdjacentHTML('afterbegin', `<div class="cx-bos">${kacis(e.message)}</div>`); });
    metin.focus();
  }

  function kapat() {
    if (kaynak) { kaynak.close(); kaynak = null; }
    clearInterval(saat); saat = null;
    disari = BOS_DISARI;
  }
  // Kabuk ve tuval buradan sürer: pano bağlamı ver, çizim modunu aç/kapat, mesaj gönder (sayfadaki "Codex çizsin")
  window.CodexPanel = { ac, kapat, baglam: (b) => disari.baglam(b), cizim: (v) => disari.cizim(v), yaz: (m, c, s) => disari.yaz(m, c, s) };
})();
