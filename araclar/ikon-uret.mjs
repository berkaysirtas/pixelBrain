// Program ikonu (K-031, Kimlik panosu seçenek A): node araclar/ikon-uret.mjs. Tek glif tanımından motor/uygulama/ altına
// favicon SVG'sini ve PWA PNG'lerini üretir (Playwright ile çizer). Glif değişirse burada değişir, sonra yeniden koşulur.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const KOYU = '#37352F', VURGU = '#D97757';
const glif = (olcek) => `<g transform="translate(32 32) scale(${olcek}) translate(-32.5 -32.5)">
<path d="M16 42 L30 16 L48 26 L40 48 Z M30 16 L40 48" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3" stroke-linejoin="round"/>
<circle cx="16" cy="42" r="6" fill="#fff"/><circle cx="30" cy="16" r="6" fill="#fff"/><circle cx="48" cy="26" r="6" fill="#fff"/><circle cx="40" cy="48" r="7.5" fill="${VURGU}"/></g>`;
const svg = (zemin, olcek) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${zemin}${glif(olcek)}</svg>`;
const YUVARLAK = svg(`<rect width="64" height="64" rx="14" fill="${KOYU}"/>`, 0.86);          // favicon, kenar çubuğu
const BOSLUKLU = svg(`<rect x="5" y="5" width="54" height="54" rx="12" fill="${KOYU}"/>`, 0.74); // PWA "any": Dock'ta kendi kenarı
const TAM = svg(`<rect width="64" height="64" fill="${KOYU}"/>`, 0.8);                          // maskable ve Apple: sistem keser
const YER = new URL('../motor/uygulama/', import.meta.url);
writeFileSync(new URL('ikon.svg', YER), YUVARLAK + '\n');
const t = await chromium.launch(), s = await t.newPage();
for (const [ad, kaynak, boy] of [['ikon-192.png', BOSLUKLU, 192], ['ikon-512.png', BOSLUKLU, 512], ['ikon-maskable-512.png', TAM, 512], ['ikon-180.png', TAM, 180]]) {
  await s.setViewportSize({ width: boy, height: boy });
  await s.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${boy}px;height:${boy}px}</style>${kaynak}`);
  await s.screenshot({ path: new URL(ad, YER).pathname, omitBackground: true });
}
await t.close();
console.log('ikonlar: motor/uygulama/');
