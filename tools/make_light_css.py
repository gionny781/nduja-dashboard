"""Genera css/light.css (tema chiaro) partendo dagli stili scuri: i vetri bianchi trasparenti
diventano veli scuri leggeri e i testi chiari diventano scuri. Lanciare dopo aver cambiato base.css o nduja.css:
    python3 tools/make_light_css.py
In fondo al file generato vengono aggiunte le regole scritte a mano di tools/light_extra.css."""
import re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent / "custom_components/nduja_dashboard/frontend/css"
# .ss*: il salvaschermo e la sua anteprima sono sempre scuri; .sz1t: i disegnini degli stili; .lt2/.lu1-6: le luci hanno regole a mano in light_extra.css; .mpa1/.mpc1: copertina e tasti della musica, a mano (la copertina è nello stile in linea); .md1*: lo schermo della TV e i loghi delle app hanno i loro colori; .ir1s/.ir1st: la scena dell'irrigazione ha i suoi colori (light_extra.css); .sq1gol/.sq1gs/.sq1gt: l'animazione del gol resta scura nei due temi, .sq1cp (righe del campo) a mano; .fo1lv/.fo1fl/.fo1rm/.fo1pp .blk/.fo1trk .via: etichetta LIVE, bandiere, messaggi della direzione gara, podio e linea del via della F1 hanno i loro colori (regole a mano in light_extra.css); .en7s: la scena dell'energia ha i suoi colori (cielo, sole, notte) uguali nei due temi
SKIP = re.compile(r"\.ss(?!tat)[a-z0-9-]|\.sz1t|\.en7s|\.lt2|\.lu[1-6]|\.lt4|\.pri|\.plus|\.act i|edt1\.on|\.logo|\.sw\b|\.edb|tile\.on|beta1|\.wel2b em|::selection|\.toast|\.dot|\.mpa1|\.mpc1|\.md1sc|\.md1gl|\.md1lg|\.md1ft|\.md1sb|\.md1sn|\.md1at\.ora|\.ir1s|\.ir1st|\.sq1gol|\.sq1gs|\.sq1gt|\.sq1cp|\.fo1lv|\.fo1fl|\.fo1rm|\.fo1pp \.blk|\.fo1trk \.via")
W = re.compile(r"rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([\d.]+)\s*\)")
TXT = re.compile(r"rgba\(\s*235\s*,\s*(?:235|240)\s*,\s*(?:245|250)\s*,\s*([\d.]+)\s*\)")

def conv_decl(prop, val):
    p = prop.strip().lower(); v = val
    if p in ("background", "background-color", "background-image"):
        if "gradient" in v and "rgba(255,255,255" not in v.replace(" ", ""): return None
        nv = W.sub(lambda m: f"rgba(0,0,0,{min(float(m.group(1)) * .5, .12):.3f})" if float(m.group(1)) <= .35 else m.group(0), v)
        return nv if nv != v else None
    if p.startswith("border") or p.startswith("outline") or p == "stroke":
        nv = W.sub(lambda m: f"rgba(0,0,0,{min(float(m.group(1)) * .7, .3):.3f})", v)
        nv = TXT.sub(lambda m: f"rgba(28,28,30,{m.group(1)})", nv)
        return nv if nv != v else None
    if p in ("color", "fill"):
        nv = v.replace("#fff", "#1c1c1e") if re.fullmatch(r"\s*#fff(\s*!important)?\s*", v) else v
        nv = TXT.sub(lambda m: f"rgba(28,28,30,{m.group(1)})", nv)
        nv = W.sub(lambda m: f"rgba(28,28,30,{m.group(1)})", nv)
        return nv if nv != v else None
    return None

def rules(css):
    """restituisce (media, selettori, dichiarazioni) senza commenti e keyframes"""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    out, i, n = [], 0, len(css)
    def block(start):
        depth, j = 1, start
        while depth and j < n:
            depth += css[j] == "{"; depth -= css[j] == "}"; j += 1
        return j
    while i < n:
        k = css.find("{", i)
        if k < 0: break
        head = css[i:k].strip(); end = block(k + 1); body = css[k + 1:end - 1]
        if head.startswith("@media"):
            for _, s, d in rules(body): out.append((head, s, d))
        elif not head.startswith("@"):
            out.append((None, head, body))
        i = end
    return out

res = ["/* tema chiaro: generato da tools/make_light_css.py — non modificare a mano */"]
for f in ("base.css", "nduja.css"):
    for media, sel, body in rules((ROOT / f).read_text()):
        decls = []
        for d in body.split(";"):
            if ":" not in d: continue
            prop, val = d.split(":", 1)
            nv = conv_decl(prop, val)
            if nv is not None:
                decls.append(f"{prop.strip()}:{nv.replace('!important', '').strip()}!important")
        if not decls: continue
        sels = [s.strip() for s in sel.split(",") if s.strip() and not SKIP.search(s)]
        if not sels: continue
        r = ",".join("body.light " + s for s in sels) + "{" + ";".join(decls) + "}"
        res.append(f"{media}{{{r}}}" if media else r)
extra = pathlib.Path(__file__).with_name("light_extra.css")
if extra.exists(): res.append(extra.read_text())
(ROOT / "light.css").write_text("\n".join(res) + "\n")
print(len(res), "regole")
