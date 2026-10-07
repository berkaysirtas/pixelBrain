// Tuvaldeki Defter ve Bilgi kartında tablo: node araclar/tablo-kart-duman.mjs (sunucu açıkken). Headless, Codex çağrılmaz.
// Geçici alanın Bilgi'sine ve Defter'ine Markdown tablo yazılır, Çizim açılır: kartlarda ham "|---|" satırı yerine tablo
// satırları görünmeli (Bilgi sekmesinde zaten tablo çiziliyordu; tuval kartı paragraf yazıyordu, 2026-10-07). Açtığını kaldırır.
import { chromium } from 'playwright';
import { geciciAlan } from './gecici-alan.mjs';
const KOK = 'http://127.0.0.1:4700';
const post = (u, b) => fetch(KOK + u, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: KOK }, body: JSON.stringify(b) }).then((r) => r.json());
const { ca, alan, temizle } = await geciciAlan('Tablo deneme', 'Bütçe alanı');
const t = await chromium.launch(); const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
const hatalar = []; s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
let sonuc = {};
try {
  const b = (await post('/api/alan-bilgi', { alan })).sonuc;
  await post('/api/sayfa', { id: b.id, govde: '## Bütçe\n\n| Kalem | Tahmin |\n|---|---|\n| Sunucu | 20 € |\n| **Alan adı** | 12 € |\n\nSon satır.' });
  const d = (await post('/api/alan-not', { alan })).sonuc;
  await post('/api/sayfa', { id: d.id, govde: '## Plan\n\n| Adım | Süre |\n|---|---|\n| Kur | 1 gün |' });
  await s.addInitScript(() => { localStorage.setItem('beyin:kurulum', 'bitti'); localStorage.setItem('beyin:oneri', 'kapali'); });
  await s.goto(`${KOK}/#/c/${ca}/${alan}/cizim`); await s.waitForSelector('#icerik iframe', { timeout: 15000 }); await s.waitForTimeout(3500);
  const fr = s.frames().find((x) => x !== s.mainFrame() && x.parentFrame() === s.mainFrame());
  sonuc = await fr.evaluate(() => [...document.querySelectorAll('.sayfa-kart')].map((k) => ({ etiket: k.querySelector('small')?.textContent, tablo: [...k.querySelectorAll('tr')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()), hamCizgi: /\|---/.test(k.innerText) })));
  await s.screenshot({ path: '.durum/tablo-kart.png' });
  for (const k of sonuc) if (k.hamCizgi || k.tablo.length < 2) hatalar.push(`${k.etiket} kartında tablo çizilmedi`);
} catch (e) { hatalar.push(String(e).slice(0, 200)); }
finally { await t.close(); temizle(); }
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));
