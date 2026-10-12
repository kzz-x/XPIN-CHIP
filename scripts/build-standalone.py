#!/usr/bin/env python3
"""Bundle the Vite production build into one offline, double-clickable HTML.
All JS, CSS and chip JSON must already be included by Vite; no runtime fetch.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
html_path = DIST / "index.html"
if not html_path.exists():
    raise SystemExit("dist/index.html missing; run npm run build first")

html = html_path.read_text(encoding="utf-8")
js_assets = list((DIST / "assets").glob("*.js"))
css_assets = list((DIST / "assets").glob("*.css"))
if len(js_assets) != 1 or len(css_assets) != 1:
    raise SystemExit(f"Expected 1 JS and 1 CSS asset; got {js_assets} / {css_assets}")

js = js_assets[0].read_text(encoding="utf-8")
css = css_assets[0].read_text(encoding="utf-8")

# HTML-escape only the script-termination sequence to avoid early termination.
js = re.sub(r"</script", r"<\\/script", js, flags=re.IGNORECASE)
css = re.sub(r"</style", r"<\\/style", css, flags=re.IGNORECASE)

script_pat = re.compile(r'<script\b(?=[^>]*\btype="module")(?=[^>]*\bsrc="[^"]+")\s[^>]*>\s*</script>', re.I)
css_pat = re.compile(r'<link\b(?=[^>]*\brel="stylesheet")(?=[^>]*\bhref="[^"]+")\s[^>]*>', re.I)

html, n_js = script_pat.subn(lambda _: '<script type="module">\n' + js + '\n</script>', html)
html, n_css = css_pat.subn(lambda _: '<style>\n' + css + '\n</style>', html)
if n_js != 1 or n_css != 1:
    raise SystemExit(f"Could not inject JS/CSS: script={n_js}, css={n_css}")

if ('./assets/' in html or 'href="/assets/' in html or 'src="/assets/' in html):
    raise SystemExit("Unbundled asset reference still present")
if 'chips/demo/' in js:
    raise SystemExit("Chip instance data was not embedded")

marker = '<meta name="viewport" content="width=device-width,initial-scale=1.0"/>'
html = html.replace(marker, marker + '\n<!-- All code, textures and chip data are bundled. No network is needed. -->', 1)
target = ROOT / "XPIN-CHIP-Standalone.html"
target.write_text(html, encoding="utf-8")
print(f"Wrote {target.name}: {len(html.encode('utf-8')):,} bytes; offline assets embedded.")
