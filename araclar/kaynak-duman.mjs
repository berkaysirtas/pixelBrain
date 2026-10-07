// Kaynaklar ve video süreci duman sınaması: node araclar/kaynak-duman.mjs [youtube-linki] (sunucu açıkken; gerçek indirme
// ve gerçek Codex özeti, kısa videoyla ~1-3 dk). Headless. Geçici alanın Bilgi sekmesinde link yapıştırılır; aşama çipleri
// görünür mü, iş bitince transkript ve storyboard diske düşer mi, özet Bilgi sayfasında "## Videolar" altına gelir mi.
// Geçici alan, video kaydı ve indirilen dosyalar sonunda kaldırılır (araclar/gecici-alan.mjs).
import { chromium } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';
import { geciciAlan } from './gecici-alan.mjs';
const KOK = 'http://127.0.0.1:4700', LINK = process.argv[2] || 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
const t = await chromium.launch();
const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
const hatalar = [], sonuc = {};
s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
const adim = async (ad, f) => { try { sonuc[ad] = await f(); } catch (e) { sonuc[ad] = 'HATA: ' + String(e).slice(0, 160); } };
const { ca, alan, temizle } = await geciciAlan('Kaynak deneme', 'Video alanı');
const vid = /([\w-]{11})(?:[&?#]|$)/.exec(LINK)?.[1];

await adim('form', async () => {
  await s.goto(`${KOK}/#/c/${ca}/${alan}/bilgi`); await s.waitForSelector('#blKaynak [data-video-ekle]', { timeout: 15000 });
  await s.fill('#blKaynak [data-video-ekle] input', LINK); await s.click('#blKaynak [data-video-ekle] button');
  await s.waitForSelector('#blKaynak .kv', { timeout: 10000 });
  return { kart: await s.$$eval('#blKaynak .kv', (e) => e.length), kapak: await s.$eval('.kv-kapak', (e, v) => e.style.backgroundImage.includes(v), vid) };
});
await adim('asamalar', async () => {
  const gorulen = new Set(), bas = Date.now();
  while (Date.now() - bas < 300000) {
    const durum = await s.$$eval('#blKaynak .kv .asama', (e) => e.map((x) => x.className + '|' + x.textContent));
    durum.filter((x) => x.includes('suruyor')).forEach((x) => gorulen.add(x.split('|')[1]));
    if (durum.some((x) => x.includes('Olmadı'))) return { hata: durum };
    if (durum.some((x) => x.includes("Özet Bilgi'de"))) return { sure: Math.round((Date.now() - bas) / 1000) + ' sn', gorulen: [...gorulen], son: durum.map((x) => x.split('|')[1]) };
    await s.waitForTimeout(1000);
  }
  return 'zaman aşımı';
});
await adim('disk', async () => {
  const kok = new URL(`../ham/kaynaklar/${ca}/${alan}/video/${vid}/`, import.meta.url);
  const dosyalar = existsSync(kok) ? readdirSync(kok) : [];
  return { transkript: dosyalar.includes('transkript.txt'), storyboard: dosyalar.filter((d) => d.startsWith('storyboard')).length,
    gecici: existsSync(new URL('../.durum/video-tmp/', import.meta.url)) ? readdirSync(new URL('../.durum/video-tmp/', import.meta.url)).length : 0 };
});
await adim('bilgi', async () => {
  // Bilgi haritası (K-043): "## " bölümü adacık başlığı ya da (içinde "### " varsa) bölüm grubu başlığı olur
  await s.waitForSelector('#syBilgi .bl-grup-ad, #syBilgi .bl-ada-ad', { timeout: 10000 });
  const basliklar = await s.$$eval('#syBilgi .bl-grup-ad>span, #syBilgi .bl-ada-ad>span', (e) => e.map((x) => x.textContent.trim()).filter(Boolean));
  const listede = (await (await fetch(`${KOK}/api/kaynaklar?alan=${alan}`)).json()).videolar.map((v) => v.asama + ' · ' + v.baslik);
  return { videolar: basliklar.includes('Videolar'), basliklar: basliklar.slice(0, 8), listede };
});
await s.screenshot({ path: '.durum/kaynak-duman.png' });
await t.close();
temizle();
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));
