// Veri ekle sıra sınaması (Mantık 1): node araclar/veri-bekle-duman.mjs (sunucu açıkken). Headless, Codex turu açmaz.
// Alanda süren video varken "Codex hemen düzenlesin" beklemeli, video bitince düzenlemeyi başlatmalı. Video durumu taklit edilir
// (/api/alan-durum), Codex'e giden istek yakalanıp kesilir. Açtığı geçici alanı kaldırır.
import { chromium } from 'playwright';
import { geciciAlan } from './gecici-alan.mjs';
const KOK = 'http://127.0.0.1:4700';
const { ca, alan, temizle } = await geciciAlan('Bekleme deneme', 'Bekleme alanı');
const t = await chromium.launch(); const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
const hatalar = [], sonuc = {}, olay = [];
s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
let videoSuruyor = true;
await s.route('**/api/alan-durum', async (r) => {
  const g = await (await r.fetch()).json();
  if (videoSuruyor) g.videolar = [{ alan, asama: 'dinleniyor', baslik: 'deneme' }];
  await r.fulfill({ json: g });
});
await s.route('**/api/codex/gonder', (r) => { olay.push(['codex', Date.now()]); r.abort(); });
try {
  await s.goto(`${KOK}/#/c/${ca}/${alan}/yazi`); await s.waitForSelector('#syYazi .sy-bloklar'); await s.waitForTimeout(800);
  await s.evaluate(() => localStorage.removeItem('beyin:veri:codex'));
  await s.click('#veriDugme'); await s.waitForTimeout(300);
  await s.fill('#metin', 'deneme notu, video ile birlikte düzenlensin'); await s.keyboard.press('Meta+Enter');
  await s.waitForTimeout(4500);
  sonuc.beklerken = { durum: await s.textContent('#vkCodexDurum').catch(() => ''), codexGitti: olay.length > 0 };
  videoSuruyor = false; olay.push(['video bitti', Date.now()]);
  await s.waitForTimeout(5000);
  sonuc.sonra = { codexGitti: olay.some(([a]) => a === 'codex'), sira: olay.map(([a]) => a) };
} finally {
  await t.close(); temizle();
}
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));
