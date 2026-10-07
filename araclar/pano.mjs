// Panoyu çizer, sayfa hatasını ve çözülmemiş alanı yazar, görüntüyü kaydeder .
// Kullanım: node araclar/pano.mjs <Pano.dc.html> [çıktı.png] [prop=değer ...]   (PORT varsayılan 4700)
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const [ad, cikti = `.durum/pano/${ad.replace(/\.dc\.html$/, '')}.png`] = process.argv.slice(2);
const PORT = process.env.PORT || 4700;
const kok = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const b = JSON.parse(fs.readFileSync(path.join(kok, 'panolar', 'canvas.json'), 'utf8')).boards[ad] || { w: 1440, h: 900 };
fs.mkdirSync(path.dirname(cikti), { recursive: true });
const t = await chromium.launch();
const s = await t.newPage({ viewport: { width: b.w, height: b.h } });
const hata = [];
s.on('pageerror', (e) => hata.push('HATA ' + String(e).slice(0, 160)));
// Motor doldurmadan önce tarayıcının okuduğu {{…}} öznitelikleri (SVG d, img src) zararsız uyarı verir: süzülür
s.on('console', (m) => { const x = m.text(); if (/never resolved|error/i.test(x) && !/\{\{|%7B%7B/.test(x)) hata.push('KONSOL ' + x.slice(0, 160)); });
const yanit = await s.goto(`http://127.0.0.1:${PORT}/project/${ad}`);
await s.waitForTimeout(1500);
if (!yanit || !yanit.ok()) hata.push(`SUNUCU ${yanit ? yanit.status() : 'cevapsız'}`);
if (await s.evaluate(() => /Minified React error/.test(document.body.textContent || ''))) hata.push('KIRMIZI KUTU (render hatası)');
const tasan = await s.evaluate(() => document.documentElement.scrollHeight > innerHeight + 2 ? document.documentElement.scrollHeight : 0);
if (tasan) hata.push(`TAŞMA içerik ${tasan}px, pano ${b.h}px`);
await s.screenshot({ path: cikti });
console.log(ad, hata.length ? [...new Set(hata)].join(' | ') : 'temiz', '·', cikti);
await t.close();
process.exit(hata.length ? 1 : 0);
