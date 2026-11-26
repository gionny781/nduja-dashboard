"""Genera css/light.css (tema chiaro) partendo dagli stili scuri: i vetri bianchi trasparenti
diventano veli scuri leggeri e i testi chiari diventano scuri. Lanciare dopo aver cambiato base.css o nduja.css:
    python3 tools/make_light_css.py
In fondo al file generato vengono aggiunte le regole scritte a mano di tools/light_extra.css."""
import re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent / "custom_components/nduja_dashboard/frontend/css"
# .ss*: il salvaschermo e la sua anteprima sono sempre scuri; .sz1t: i disegnini degli stili; .lt2/.lu1-6: le luci hanno regole a mano in light_extra.css; .mpa1/.mpc1: copertina e tasti della musica, a mano (la copertina è nello stile in linea); .md1*: lo schermo della TV e i loghi delle app hanno i loro colori; .ir1s/.ir1st: la scena dell'irrigazione ha i suoi colori (light_extra.css); .sq1gol/.sq1gs/.sq1gt: l'animazione del gol resta scura nei due temi, .sq1cp (righe del campo) a mano; .fo1lv/.fo1fl/.fo1rm/.fo1pp .blk/.fo1trk .via: etichetta LIVE, bandiere, messaggi della direzione gara, podio e linea del via della F1 hanno i loro colori (regole a mano in light_extra.css); chat (.kt*): le mie bolle blu, le foto delle persone, i contatori, la didascalia delle foto, il tasto ➤ e il segnaposto restano uguali nei due temi; .en7s: la scena dell'energia ha i suoi colori (cielo, sole, notte) uguali nei due temi; .tp1d/.tp1p: disegni delle tapparelle e percentuale sopra (colori a mano in light_extra.css); .ar1s/.ar1d: scena dell'aria e disegnini dei purificatori (colori a mano in light_extra.css); .aq1s: contatori dell'acqua e del gas e fiamma (colori propri, uguali nei due temi); assistente vocale: le mie bolle blu, il microfono, il pulsante flottante, ➤ e il pulsante acceso (.vc1b.io/.vc1mic/.vc1f/.vc1s/.vc1p.on) restano uguali nei due temi; .pi1s: i disegni delle piante hanno i loro colori, uguali nei due temi; .tr1no: la riga rossa «qui non può andare» del trascinamento resta uguale nei due temi; .es1: la fascia arancione della casa di esempio resta uguale nei due temi; body.hc: il contrasto alto del tema chiaro è scritto a mano in light_extra.css
SKIP = re.compile(r"\.ss(?!tat)[a-z0-9-]|\.sz1t|\.en7s|\.lt2|\.lu[1-6]|\.lt4|\.pri|\.plus|\.act i|edt1\.on|\.logo|\.sw\b|\.edb|tile\.on|beta1|\.wel2b em|::selection|\.toast|\.dot|\.mpa1|\.mpc1|\.md1sc|\.md1gl|\.md1lg|\.md1ft|\.md1sb|\.md1sn|\.md1at\.ora|\.ir1s|\.ir1st|\.sq1gol|\.sq1gs|\.sq1gt|\.sq1cp|\.fo1lv|\.fo1fl|\.fo1rm|\.fo1pp \.blk|\.fo1trk \.via|\.me \.ktb1|\.me \.kts1|\.kta1|\.mt em|\.ktf1 span|\.ktin1s|\.ktp1m \.pin|\.tp1d|\.tp1p|\.ar1s\b|\.ar1d\b|\.aq1s\b|\.vc1b\.io|\.vc1mic|\.vc1f\b|\.vc1s\b|\.vc1p\.on|\.pi1s\b|\.tr1no|\.es1|body\.hc")
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
# ---- accenti leggibili (0.7.62): nel tema chiaro i testi colorati (giallo, verde, arancione, azzurro…) pensati per il fondo scuro
# hanno poco contrasto sul vetro chiaro. Qui li scurisco quanto basta per il contrasto WCAG AA (4,5:1, con margine: 5:1) su un fondo chiaro, stessa tinta.
# Con :where() la specificità resta quella della regola di partenza: vince solo su di lei (viene dopo), non sulle regole più specifiche
# (per esempio un testo bianco su un pulsante colorato). Solo la proprietà color, non i disegni (fill) né gli sfondi.
import colorsys
VARS = {"blue": "#0a84ff", "green": "#30d158", "orange": "#ff9f0a", "red": "#ff453a", "yellow": "#ffd60a", "purple": "#bf5af2", "teal": "#64d2ff",
        "pink": "#ff375f", "indigo": "#5e5ce6", "warm": "#ffb340", "warm2": "#ff9f0a", "cool": "#64d2ff", "ok": "#30d158", "bad": "#ff453a", "sun": "#ffd60a", "vio": "#bf5af2"}
def _lin(c):
    c /= 255; return c / 12.92 if c <= .03928 else ((c + .055) / 1.055) ** 2.4
def _lum(r, g, b): return .2126 * _lin(r) + .7152 * _lin(g) + .0722 * _lin(b)
FONDO = _lum(0xee, 0xf1, 0xf5)
def _cr(rgb): l = _lum(*rgb); return (max(l, FONDO) + .05) / (min(l, FONDO) + .05)
def colore(v):
    v = v.strip().replace("!important", "").strip()
    m = re.fullmatch(r"var\(--([\w-]+)\)", v)
    if m: v = VARS.get(m.group(1), "")
    m = re.fullmatch(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})", v)
    if m:
        h = m.group(1); h = "".join(c * 2 for c in h) if len(h) == 3 else h
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    m = re.fullmatch(r"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)", v)
    if m and float(m.group(4) or 1) >= .6: return tuple(int(m.group(i)) for i in (1, 2, 3))
    return None
def scurisci(rgb):
    h, l, s = colorsys.rgb_to_hls(*[c / 255 for c in rgb])
    if s < .25 or l >= .8 or _cr(rgb) >= 4.6: return None   # grigi; bianchi e quasi bianchi (testi sulle scene scure, uguali nei due temi); già leggibili
    while l > .05:
        l -= .01; c = tuple(round(x * 255) for x in colorsys.hls_to_rgb(h, l, s))
        if _cr(c) >= 5: return "#%02x%02x%02x" % c
    return None
def dove(s):
    s = s.strip()
    return ("body:where(.light)" + s[4:]) if re.match(r"body(?![\w-])", s) else ":where(body.light) " + s
acc = 0
for f in ("base.css", "nduja.css"):
    for media, sel, body in rules((ROOT / f).read_text()):
        for d in body.split(";"):
            if ":" not in d: continue
            prop, val = d.split(":", 1)
            if prop.strip().lower() != "color": continue
            rgb = colore(val); nv = scurisci(rgb) if rgb else None
            if not nv: continue
            sels = [x.strip() for x in sel.split(",") if x.strip() and not SKIP.search(x) and not x.strip().startswith(("html", ":root"))]
            if not sels: continue
            r = ",".join(dove(x) for x in sels) + "{color:" + nv + ("!important" if "!important" in val else "") + "}"
            res.append(f"{media}{{{r}}}" if media else r); acc += 1
print(acc, "testi colorati scuriti")
extra = pathlib.Path(__file__).with_name("light_extra.css")
if extra.exists(): res.append(extra.read_text())
(ROOT / "light.css").write_text("\n".join(res) + "\n")
print(len(res), "regole")
