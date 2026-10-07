// Canlı çizim, gerçek Codex turu (K-077): node araclar/cizim-codex-duman.mjs (sunucu açıkken; gerçek tur, 1-3 dk).
// Headless. Geçici alanın Çizim'inde çizim moduyla bir pano istenir. Bakılanlar: Codex panoyu <pano-yaz> bloğuyla veriyor mu
// (pano tur bitmeden tuvalde ve içeriği büyüyor mu), ilk çizgi kaçıncı saniyede, tur kaç saniyede bitiyor, dosya ve tuval
// kaydı doğru mu, sohbette ham HTML yerine "Çizdi" satırı mı var, tur Fast katmanıyla mı gitti. Açtığını kaldırır.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { geciciAlan } from './gecici-alan.mjs';
const KOK = 'http://127.0.0.1:4700', REPO = new URL('..', import.meta.url), yol = (p) => new URL(p, REPO);
const ISTEK = process.argv[2] || 'Bir satış görüşmesinin beş adımını (karşılama, ihtiyacı dinleme, çözüm, teklif, kapanış) tek bir pano olarak çiz; her adımda iki kısa madde olsun.';
const { ca, alan, temizle } = await geciciAlan('Çizim Codex deneme', 'Çizim alanı');
const sayfa = 'page-' + alan;
const panolar = () => Object.entries(JSON.parse(readFileSync(yol('panolar/canvas.json'), 'utf8')).boards).filter(([, v]) => v.page === sayfa);
const t = await chromium.launch();
const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
const hatalar = [], sonuc = {};
s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
await s.addInitScript(() => { localStorage.setItem('beyin:kurulum', 'bitti'); localStorage.setItem('beyin:oneri', 'kapali'); localStorage.setItem('beyin:sekme:panel', 'codex'); });
const tuval = () => s.frames().find((f) => f !== s.mainFrame() && f.parentFrame() === s.mainFrame());
const akis = () => tuval().evaluate(() => { const f = document.querySelector('.pano iframe.akis'); return f ? { harf: f.contentDocument.body.innerText.length, oge: f.contentDocument.body.querySelectorAll('*').length } : null; }).catch(() => null);
try {
  await s.goto(`${KOK}/#/c/${ca}/${alan}/cizim`); await s.waitForSelector('#icerik iframe', { timeout: 15000 }); await s.waitForSelector('.cx-yaz textarea', { timeout: 20000 }); await s.waitForTimeout(2500);
  const t0 = Date.now(), gecen = () => Math.round((Date.now() - t0) / 100) / 10;
  await s.evaluate((m) => window.CodexPanel.yaz(m, true), ISTEK);
  let ilk = null, ilkYazi = null, tuvalde = null, bitti = null, ornek = [], cekildi = 0;
  while (Date.now() - t0 < 300000) {
    if (tuvalde === null && panolar().length) tuvalde = gecen();
    const a = await akis();
    if (a && a.oge > 0 && ilk === null) ilk = gecen();
    if (a && a.harf > 0 && ilkYazi === null) ilkYazi = gecen();  // panoda ilk okunur yazı: stil yazılırken pano boş görünür
    if (a) { ornek.push([gecen(), a.harf, a.oge]); if (a.harf > 40 && cekildi < 3 && ornek.length % 6 === 1) await s.screenshot({ path: `.durum/cizim-codex-${++cekildi}.png` }); }
    if (await s.$eval('#cxAkis .cx-canli', (c) => c.hidden).catch(() => false) && Date.now() - t0 > 8000) { bitti = gecen(); break; }
    await s.waitForTimeout(700);
  }
  await s.waitForTimeout(3500);
  await s.screenshot({ path: '.durum/cizim-codex-son.png' });
  const p = panolar(), [ad, v] = p[0] || [], dosya = ad && existsSync(yol('panolar/' + ad)) ? readFileSync(yol('panolar/' + ad), 'utf8') : '';
  const olcum = readFileSync(yol('.durum/codex-olcum.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((o) => o.alan === alan).pop() || {};
  if (dosya) writeFileSync(yol('.durum/cizim-codex-pano.html'), dosya);
  sonuc.sure = { tuvalde_sn: tuvalde, ilk_cizgi_sn: ilk, ilk_yazi_sn: ilkYazi, bitti_sn: bitti, akarken_ornek: ornek.length, buyudu: ornek.length > 1 && ornek.at(-1)[1] > ornek[0][1], ornekler: ornek.filter((_, i) => i % 5 === 0).slice(0, 10) };
  sonuc.pano = { adet: p.length, ad, baslik: v?.title, boy: v && [v.w, v.h], dosya_boyu: dosya.length, iskelet: dosya.startsWith('<!doctype html>') && dosya.includes('<x-dc>'), tema: dosya.includes('tema.css'),
    ham_renk: (dosya.match(/#[0-9A-Fa-f]{6}\b/g) || []).length, yer_tutucu_kaldi: dosya.length < 600,
    stil: [...dosya.matchAll(/<style>([\s\S]*?)<\/style>/g)].reduce((t, m) => t + m[1].length, 0) + [...dosya.matchAll(/style="([^"]*)"/g)].reduce((t, m) => t + m[1].length, 0) };
  sonuc.sohbet = await s.evaluate(() => ({ cip: [...document.querySelectorAll('#cxAkis .cx-pano-cip')].map((c) => c.textContent.trim()), hamHtml: /<div|pano-yaz|<helmet/.test(document.querySelector('#cxAkis').innerText),
    cevap: [...document.querySelectorAll('#cxAkis .cx-codex .cx-metin')].map((m) => m.innerText.trim()).filter(Boolean).pop()?.slice(0, 160), adim: document.querySelectorAll('#cxAkis .cx-adim').length,
    mesajlar: [...document.querySelectorAll('#cxAkis .cx-codex')].map((m) => ({ blok: (m.dataset.ham.match(/<pano-yaz/g) || []).length, ham: m.dataset.ham.length, duz: m.dataset.metin.slice(0, 50) })) }));
  sonuc.olcum = { katman: olcum.katman, efor: olcum.efor, ilk_soz: olcum.ilk_soz, ilk_pano: olcum.ilk_pano, toplam: olcum.toplam, adim: olcum.adim, arac: olcum.arac, pano_akis: olcum.pano_akis };
  sonuc.tuval = await tuval().evaluate(() => ({ pano: document.querySelectorAll('.pano').length, akisKaldi: !!document.querySelector('.pano iframe.akis') }));
  // Çizim modunda meta soru (K-079 hız): kaynak sorusunda pano yeniden çizilmez, cevap metinle gelir
  if (process.env.SORU !== '0') {
    const t1 = Date.now(), panolarOnce = JSON.stringify(panolar());
    await s.evaluate(() => window.CodexPanel.yaz('Bu bilgiyi nereden aldın?', true));
    await s.waitForTimeout(3000);
    while (Date.now() - t1 < 180000) { if (await s.$eval('#cxAkis .cx-canli', (c) => c.hidden).catch(() => false)) break; await s.waitForTimeout(700); }
    const son = await s.evaluate(() => { const m = [...document.querySelectorAll('#cxAkis .cx-codex')].pop(); return { blok: (m?.dataset.ham.match(/<pano-yaz/g) || []).length, metin: (m?.dataset.metin || '').slice(0, 160) }; });
    sonuc.meta_soru = { sure_sn: Math.round((Date.now() - t1) / 100) / 10, pano_blogu: son.blok, pano_degismedi: JSON.stringify(panolar()) === panolarOnce, cevap: son.metin };
    if (son.blok) hatalar.push('meta soruda pano yeniden çizildi');
  }
  if (!ilk) hatalar.push('akış görülmedi: Codex panoyu blokla vermedi ya da tuvale ulaşmadı');
} catch (e) { hatalar.push(String(e).slice(0, 200)); }
finally {
  await t.close();
  await fetch(KOK + '/api/codex/dur', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alan }) }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1500));
  const c = JSON.parse(readFileSync(yol('panolar/canvas.json'), 'utf8'));
  for (const [ad, v] of Object.entries(c.boards)) if (v.page === sayfa) { delete c.boards[ad]; c.order = (c.order || []).filter((x) => x !== ad); rmSync(yol('panolar/' + ad), { force: true }); }
  writeFileSync(yol('panolar/canvas.json'), JSON.stringify(c, null, 1) + '\n');
  temizle();
}
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));
