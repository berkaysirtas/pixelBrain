#!/usr/bin/env python3
"""Konuşma arşivi: Claude Code ve Codex konuşmaları ham/konusmalar/ altına, oturum başına bir .md.

Ham katman değişmez ve ortaktır (izole değil). Claude Code ham kayıtlarını 30 gün sonra siler; söz ancak burada kalır.
- Claude: ~/.claude/projects/<bu repo anahtarı>/*.jsonl. Senin mesajların (tur ortasında yazdıkların dahil) ve
  Claude'un metinleri alınır; araç çıktıları, düşünme ve sistem notları alınmaz.
- Codex: ~/.codex/sessions/**/rollout-*.jsonl, çalışma klasörü bu repo olanlar. Sen ve Codex'in metinleri.
Artımlı: dosya başına okunan bayt .durum/arsiv.json'da. Parola ve anahtar biçimindeki metin gizlenir.

Kullanım: python3 araclar/arsiv.py [--commit]   (Stop kancası her turdan sonra --commit ile çağırır)
"""
import glob
import json
import os
import re
import subprocess
import sys
from datetime import datetime

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CIKTI = os.path.join(KOK, 'ham', 'konusmalar')
DURUM = os.path.join(KOK, '.durum', 'arsiv.json')
CLAUDE = os.path.join(os.environ.get('CLAUDE_CONFIG_DIR', os.path.expanduser('~/.claude')), 'projects',
                      re.sub(r'[^A-Za-z0-9]', '-', KOK))
CODEX = os.path.expanduser('~/.codex/sessions')
SISTEM = ('<local-command', '<command-', 'Caveat:', 'This session is being continued', '[Request interrupted',
          'Stop hook feedback', '<task-notification', '<system-reminder', '<environment_context', '<user_instructions',
          '# AGENTS.md', '<permissions', '<bash-input>', '<bash-stdout>', '<bash-stderr>')
GIZLI = [(re.compile(p), r) for p, r in (
    (r'sk-[A-Za-z0-9_-]{20,}', '[gizli]'), (r'ghp_[A-Za-z0-9]{20,}', '[gizli]'), (r'github_pat_[A-Za-z0-9_]{20,}', '[gizli]'),
    (r'AKIA[0-9A-Z]{16}', '[gizli]'), (r'xox[baprs]-[A-Za-z0-9-]{10,}', '[gizli]'),
    (r'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}', '[gizli]'),
    (r'-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----', '[gizli]'),
    (r'\b([a-z][a-z0-9+]*://[^\s:@/]+:)[^\s@/]+@', r'\1[gizli]@'),
    (r'(?i)\b(password|parola|şifre|sifre|api[_-]?key|secret|token)\b(\s*[:=]\s*)\S+', r'\1\2[gizli]'),
    (r'\b([A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|SIFRE|ANAHTARI|PASSWORD))=\S+', r'\1=[gizli]'))]


def gizle(metin):
    for desen, yerine in GIZLI:
        metin = desen.sub(yerine, metin)
    return metin


def basliklari_indir(metin):
    """Mesaj içindeki '## Başlık' satırları iki seviye iner: oturum dosyasındaki mesaj başlıklarıyla karışmaz. Kod bloğu korunur."""
    satirlar, kodda = [], False
    for s in metin.splitlines():
        if s.lstrip().startswith('```'):
            kodda = not kodda
        elif not kodda:
            s = re.sub(r'^(#{1,4}) ', lambda m: '#' * (len(m.group(1)) + 2) + ' ', s)
        satirlar.append(s)
    return '\n'.join(satirlar)


def saat(damga):
    try:
        return datetime.fromisoformat(damga.replace('Z', '+00:00')).astimezone()
    except (ValueError, AttributeError):
        return None


ETIKET = re.compile(r'^\s*<[a-z_][a-z0-9_-]*>')  # Codex'in eklediği <recommended_plugins> gibi bloklar


def sistem_mi(metin):
    return not metin.strip() or metin.lstrip().startswith(SISTEM) or bool(ETIKET.match(metin))


def claude_satiri(o):
    """(zaman, kim, metin) ya da None."""
    tur = o.get('type')
    if tur == 'queue-operation' and o.get('operation') == 'enqueue':
        metin = str(o.get('content') or '')
        return None if sistem_mi(metin) else (o.get('timestamp'), 'Sen · tur ortasında', metin)
    if o.get('isSidechain') or o.get('isMeta') or o.get('isCompactSummary') or tur not in ('user', 'assistant'):
        return None
    icerik = (o.get('message') or {}).get('content')
    if isinstance(icerik, str):
        parcalar = [icerik]
    elif isinstance(icerik, list):
        parcalar = [b.get('text', '') for b in icerik if isinstance(b, dict) and b.get('type') == 'text']
    else:
        return None
    metin = '\n\n'.join(p for p in parcalar if p and not sistem_mi(p)).strip()
    if not metin:
        return None
    return o.get('timestamp'), 'Sen' if tur == 'user' else 'Claude', metin


PANO_BLOK = re.compile(r'<pano-yaz\b([^>]*)>.*?(?:</pano-yaz>|\Z)', re.S)


def pano_ozet(metin):
    """Canlı çizim (K-077): Codex panoyu cevabında <pano-yaz> bloğuyla verir; gövdesi arşive girmez, adı ve başlığı kalır."""
    oz = lambda m, k: (re.search(k + r'="([^"]*)"', m.group(1)) or [None, ''])[1]
    return PANO_BLOK.sub(lambda m: f"[pano: {oz(m, 'baslik') or oz(m, 'ad')} ({oz(m, 'ad')})]", metin)


def codex_satiri(o):
    p = o.get('payload') or {}
    if o.get('type') != 'response_item' or p.get('type') != 'message' or p.get('role') not in ('user', 'assistant'):
        return None
    metin = '\n\n'.join(pano_ozet(b.get('text', '')) for b in p.get('content') or []
                        if isinstance(b, dict) and b.get('type') in ('input_text', 'output_text') and not sistem_mi(b.get('text', ''))).strip()
    return (o.get('timestamp'), 'Sen' if p['role'] == 'user' else 'Codex', metin) if metin else None


def codex_bu_repo_mu(yol):
    try:
        with open(yol, encoding='utf-8') as f:
            ilk = json.loads(f.readline())
    except (OSError, ValueError):
        return False
    cwd = (ilk.get('payload') or {}).get('cwd') or ''
    return ilk.get('type') == 'session_meta' and (cwd == KOK or cwd.startswith(KOK + os.sep))


def kaynaklar():
    for yol in sorted(glob.glob(os.path.join(CLAUDE, '*.jsonl'))):
        yield yol, 'Claude', claude_satiri
    for yol in sorted(glob.glob(os.path.join(CODEX, '*', '*', '*', 'rollout-*.jsonl'))):
        if codex_bu_repo_mu(yol):
            yield yol, 'Codex', codex_satiri


def arsivle():
    try:
        with open(DURUM, encoding='utf-8') as f:
            durum = json.load(f)
    except (OSError, ValueError):
        durum = {}
    os.makedirs(CIKTI, exist_ok=True)
    yazilan = 0
    for yol, kaynak, cevir in kaynaklar():
        kayit = durum.get(yol) or {}
        boyut = os.path.getsize(yol)
        bas = kayit.get('bayt', 0) if kayit.get('bayt', 0) <= boyut else 0
        if bas == boyut and kayit.get('cikti'):
            continue
        satirlar = []
        with open(yol, 'rb') as f:
            f.seek(bas)
            veri = f.read()
        son = veri.rfind(b'\n') + 1  # yarım satır bir sonraki koşuya kalır
        for ham in veri[:son].splitlines():
            try:
                o = json.loads(ham)
            except ValueError:
                continue
            satir = cevir(o)
            if satir:
                satirlar.append(satir)
        kayit['bayt'] = bas + son
        if satirlar:
            ilk = saat(satirlar[0][0]) or datetime.now().astimezone()
            oturum = re.search(r'([0-9a-f]{8})-[0-9a-f]{4}-', os.path.basename(yol))
            cikti = kayit.get('cikti') or f'{ilk:%Y-%m-%d}-{kaynak.lower()}-{oturum.group(1) if oturum else "oturum"}.md'
            hedef = os.path.join(CIKTI, cikti)
            yeni = not os.path.exists(hedef)
            with open(hedef, 'a', encoding='utf-8') as f:
                if yeni:  # hafıza: ham konuşma hafıza değil, bağlama kendiliğinden girmez
                    f.write('---\nvisibility: private\nkind: transcript\n---\n')
                    f.write(f'# Konuşma · {kaynak} · {ilk:%Y-%m-%d %H:%M}\n\nKaynak: `{os.path.basename(yol)}`. Ham kayıt, değişmez.\n')
                for damga, kim, metin in satirlar:
                    z = saat(damga)
                    f.write(f'\n## {z:%d.%m %H:%M} · {kim}\n\n' if z else f'\n## {kim}\n\n')
                    f.write(basliklari_indir(gizle(metin)).rstrip() + '\n')
            kayit['cikti'] = cikti
            yazilan += len(satirlar)
        durum[yol] = kayit
    os.makedirs(os.path.dirname(DURUM), exist_ok=True)
    with open(DURUM, 'w', encoding='utf-8') as f:
        json.dump(durum, f, ensure_ascii=False, indent=1)
    return yazilan


def commitle():
    def git(*a):
        return subprocess.run(['git', '-C', KOK, *a], capture_output=True, text=True)
    git('add', '--', 'ham/konusmalar')
    if git('diff', '--cached', '--quiet', '--', 'ham/konusmalar').returncode:
        git('commit', '-q', '-m', 'arşiv: konuşma', '--', 'ham/konusmalar')
        return True
    return False


if __name__ == '__main__':
    n = arsivle()
    c = commitle() if '--commit' in sys.argv else False
    print(f'arşiv: {n} mesaj' + (', commit' if c else ''))
