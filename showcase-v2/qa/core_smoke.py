"""Showcase V2 core smoke test (headless only; a browser window never appears).

Usage (server must be running:  python serve.py 8820  from showcase-v2/):
  ../studio/.venv/Scripts/python.exe qa/core_smoke.py                 # tests sites/_template
  ../studio/.venv/Scripts/python.exe qa/core_smoke.py --site mustang-hearth --port 8820
Writes qa/core_smoke_<site>.json and prints PASS/FAIL per check. Exit code 1 if any check fails.
The script finds dishes via [data-add] buttons, so it works on any site built from the template.
"""
import argparse, gzip, json, os, re, sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
V2 = os.path.dirname(HERE)
AXE = os.path.join(V2, '..', 'reference', 'nextjs-prototype', 'node_modules', 'axe-core', 'axe.min.js')
VIEWPORTS = [(1440, 900), (1024, 768), (390, 844), (360, 640)]

ap = argparse.ArgumentParser()
ap.add_argument('--site', default='_template')
ap.add_argument('--port', default='8820')
args = ap.parse_args()
ORIGIN = f'http://localhost:{args.port}'
BASE = f'{ORIGIN}/sites/{args.site}/'
results, data = [], {}


def check(name, ok, info=''):
    results.append({'check': name, 'ok': bool(ok), 'info': info})
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{info}]' if info else ''))


def launch(p):
    # Playwright 1.48 passes --headless=old, which current Chrome removed; --headless=new keeps it headless.
    return p.chromium.launch(channel='chrome', headless=True, args=['--headless=new'])


def watch(page, errs, reqs=None):
    page.on('console', lambda m: errs.append(f'console.{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: errs.append(f'pageerror: {e}'))
    if reqs is not None:
        page.on('request', lambda r: reqs.append(r.url))


def add_two(page):
    btns = page.locator('[data-menu] [data-add]')
    btns.nth(0).click(); btns.nth(1).click()


def active(page, js='el => el'):
    return page.evaluate(f'(() => {{ const el = document.activeElement; return ({js})(el); }})()')


def tab_to(page, pred_js, limit=250, shift=False):
    for _ in range(limit):
        page.keyboard.press('Shift+Tab' if shift else 'Tab')
        if page.evaluate(f'(() => {{ const el = document.activeElement; return !!({pred_js}); }})()'):
            return True
    return False


with sync_playwright() as p:
    br = launch(p)

    # 1. errors, horizontal scroll and network at 4 viewports, 3 pages (checkout with items)
    all_errs, foreign, overflow = [], set(), []
    for w, h in VIEWPORTS:
        ctx = br.new_context(viewport={'width': w, 'height': h})
        pg = ctx.new_page(); errs, reqs = [], []
        watch(pg, errs, reqs)
        pg.goto(BASE + 'menu.html', wait_until='networkidle')
        add_two(pg)
        for name in ['index', 'menu', 'checkout']:
            pg.goto(BASE + name + '.html', wait_until='networkidle')
            pg.evaluate('window.scrollTo(0, document.body.scrollHeight)'); pg.wait_for_timeout(250)
            sw = pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
            if sw > 0: overflow.append(f'{name}@{w}: {sw}px')
        for u in reqs:
            pu = urlparse(u)
            if pu.scheme not in ('data', 'blob') and f'{pu.scheme}://{pu.netloc}' != ORIGIN: foreign.add(u)
        all_errs += [f'{w}: {e}' for e in errs]
        ctx.close()
    check('0 console/page errors at 1440, 1024, 390x844, 360x640 (home, menu, checkout)', not all_errs, '; '.join(all_errs[:5]))
    check('no horizontal scroll', not overflow, '; '.join(overflow))
    check('offline-capable: only same-origin requests', not foreign, '; '.join(sorted(foreign)[:5]))

    # 2. conversion path by taps at 390x844 (touch)
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
    pg = ctx.new_page(); errs = []; watch(pg, errs)
    taps = 0
    def tap(loc):
        global taps
        loc.tap(); taps += 1
    pg.goto(BASE + 'index.html', wait_until='networkidle')
    tap(pg.locator('[data-mbar-order]'))
    pg.wait_for_url('**/menu.html')
    tap(pg.locator('[data-menu] [data-add]').nth(0))
    tap(pg.locator('[data-menu] [data-add]').nth(1))
    tap(pg.locator('[data-mbar-cart]'))
    total_in_drawer = pg.locator('[data-cart-checkout]').inner_text()
    tap(pg.locator('[data-cart-checkout]'))
    pg.wait_for_url('**/checkout.html')
    pickup_default = pg.locator('#mode-pickup').is_checked()
    tap(pg.locator('#c-name')); pg.keyboard.type('Test Person')
    tap(pg.locator('#c-phone')); pg.keyboard.type('555 555 0100')
    label = pg.locator('[data-place-order]').inner_text()
    tap(pg.locator('[data-place-order]'))
    conf = pg.locator('[data-confirmation]')
    ok = conf.is_visible() and re.match(r'#\d{4}', pg.locator('[data-conf-number]').inner_text() or '')
    data['order_path'] = {'taps': taps, 'drawer_button': total_in_drawer, 'place_label': label,
                          'number': pg.locator('[data-conf-number]').inner_text(), 'ready': pg.locator('[data-conf-time]').inner_text(),
                          'focus_after': active(pg, 'el => el.textContent.trim().slice(0,60)')}
    badge = pg.locator('[data-cart-count]').first.inner_text()
    check('order path 390x844: home -> confirmation in <= 8 taps', ok and taps <= 8 and pickup_default, f'{taps} taps; {label!r}; {data["order_path"]["number"]}, ready {data["order_path"]["ready"]}')
    check('cart cleared after order', badge == '0', f'badge {badge}')
    check('total shown in drawer and in place-order label', '$' in total_in_drawer and '$' in label)

    # 3. booking path at 390x844 (touch)
    pg.goto(BASE + 'index.html', wait_until='networkidle')
    inter = 0
    pg.locator('.mbar a[href$="#reserve"]').tap(); pg.wait_for_timeout(600)
    pg.locator('#r-name').tap(); inter += 1; pg.keyboard.type('Test Person')
    pg.locator('#r-phone').tap(); inter += 1; pg.keyboard.type('5555550100')
    pg.locator('#reserve-form button[type=submit]').tap(); inter += 1
    rc = pg.locator('[data-reserve-confirm]')
    ref = pg.locator('[data-reserve-ref]').inner_text() if rc.is_visible() else ''
    check('booking: Book tap + 3 interactions + confirmation', rc.is_visible() and ref.startswith('WS-') and inter <= 3,
          f'{inter} interactions after Book; ref {ref}; {pg.locator("[data-reserve-summary]").inner_text() if ref else ""}')
    check('booking confirmation receives focus', active(pg, 'el => el.hasAttribute("data-reserve-confirm-heading")'))
    check('no errors during touch paths', not errs, '; '.join(errs[:3]))
    ctx.close()

    # 4. keyboard-only order path at 1440
    ctx = br.new_context(viewport={'width': 1440, 'height': 900})
    pg = ctx.new_page(); errs = []; watch(pg, errs)
    pg.goto(BASE + 'menu.html', wait_until='networkidle')
    pg.keyboard.press('Tab')
    skip_first = active(pg, 'el => el.classList.contains("skip-link")')
    pg.keyboard.press('Enter')
    skip_ok = active(pg, 'el => el.id === "main"')
    a1 = tab_to(pg, 'el.matches("[data-filter]")')
    pg.keyboard.press('Enter'); pressed = active(pg, 'el => el.getAttribute("aria-pressed")'); pg.keyboard.press('Enter')
    a2 = tab_to(pg, 'el.matches("[data-menu] [data-add]")'); pg.keyboard.press('Enter')
    a3 = tab_to(pg, 'el.matches("[data-menu] [data-add]")'); pg.keyboard.press('Enter')
    count = pg.locator('[data-cart-count]').first.inner_text()
    a4 = tab_to(pg, 'el.matches(".cart-btn")', shift=True)
    pg.keyboard.press('Enter'); pg.wait_for_timeout(350)
    in_dialog = active(pg, 'el => !!el.closest("[role=dialog]")')
    a5 = tab_to(pg, 'el.dataset.action === "inc"', 20); pg.keyboard.press('Enter')
    count2 = pg.locator('[data-cart-count]').first.inner_text()
    focus_kept = active(pg, 'el => el.dataset.action')
    # focus trap
    trapped = True
    for i in range(40):
        pg.keyboard.press('Tab')
        trapped &= active(pg, 'el => !!el.closest(".drawer__panel")')
    for i in range(20):
        pg.keyboard.press('Shift+Tab')
        trapped &= active(pg, 'el => !!el.closest(".drawer__panel")')
    main_inert = pg.evaluate('document.querySelector("main").inert && document.querySelector("header").inert')
    live_ok = pg.evaluate('(() => { const l = document.querySelector("[data-live]"); return !!l && !l.closest("[inert]") && l.textContent.length > 0; })()')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(350)
    returned = active(pg, 'el => el.classList.contains("cart-btn")')
    restored = pg.evaluate('!document.querySelector("main").inert')
    check('keyboard: skip link first, focuses main', skip_first and skip_ok)
    check('keyboard: filter chip toggles aria-pressed', a1 and pressed == 'true')
    check('keyboard: add 2 items, open drawer, focus inside dialog', a2 and a3 and a4 and count == '2' and in_dialog, f'count {count}')
    check('keyboard: quantity + keeps focus on the stepper', a5 and count2 == '3' and focus_kept == 'inc', f'count {count2}, focus {focus_kept}')
    check('drawer: focus trap (40 Tab + 20 Shift+Tab stay inside), background inert', trapped and main_inert)
    check('drawer: live region outside inert announces', live_ok)
    check('drawer: Esc closes, focus returns to opener, inert cleared', returned and restored)
    pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    tab_to(pg, 'el.matches("[data-cart-checkout]")', 30); pg.keyboard.press('Enter')
    pg.wait_for_url('**/checkout.html'); pg.wait_for_load_state('networkidle')
    tab_to(pg, 'el.id === "c-name"'); pg.keyboard.type('Key Board')
    pg.keyboard.press('Tab'); pg.keyboard.type('5555550100')
    # submit with invalid email to see validation, then fix
    pg.keyboard.press('Tab'); pg.keyboard.type('bad')
    tab_to(pg, 'el.matches("[data-place-order]")'); pg.keyboard.press('Enter')
    sum_focus = active(pg, 'el => el.matches("[data-error-summary]")')
    em = pg.evaluate('(() => { const f = document.getElementById("c-email"); return [f.getAttribute("aria-invalid"), f.getAttribute("aria-describedby")]; })()')
    tab_to(pg, 'el.matches("[data-error-summary] a")', 5); pg.keyboard.press('Enter')
    on_email = active(pg, 'el => el.id')
    pg.keyboard.press('Control+A'); pg.keyboard.type('key@example.com')
    tab_to(pg, 'el.matches("[data-place-order]")'); pg.keyboard.press('Enter')
    done = pg.locator('[data-confirmation]').is_visible() and active(pg, 'el => el.hasAttribute("data-conf-heading")')
    check('validation: error summary focused, aria-invalid + aria-describedby, link moves to field',
          sum_focus and em[0] == 'true' and 'c-email-error' in (em[1] or '') and on_email == 'c-email', f'{em}, link -> {on_email}')
    check('keyboard: checkout pickup submit -> confirmation focused', done)
    # booking by keyboard + empty submit validation
    pg.goto(BASE + 'index.html#reserve', wait_until='networkidle')
    pg.locator('#r-name').focus()
    tab_to(pg, 'el.matches("#reserve-form button[type=submit]")', 10); pg.keyboard.press('Enter')
    errs_shown = pg.evaluate('[...document.querySelectorAll("#reserve-form [aria-invalid=true]")].map(e => e.id)')
    sumf = active(pg, 'el => el.matches("[data-error-summary]")')
    pg.locator('#r-name').focus(); pg.keyboard.type('Key Board'); pg.keyboard.press('Tab'); pg.keyboard.type('5555550100')
    tab_to(pg, 'el.matches("#reserve-form button[type=submit]")', 10); pg.keyboard.press('Enter')
    check('keyboard booking: empty submit flags name+phone, then confirms', set(errs_shown) == {'r-name', 'r-phone'} and sumf and pg.locator('[data-reserve-confirm]').is_visible(), f'invalid {errs_shown}')
    check('no errors during keyboard paths', not errs, '; '.join(errs[:3]))
    ctx.close()

    # 5. mobile nav, sticky bar behaviour, target sizes at 390
    ctx = br.new_context(viewport={'width': 390, 'height': 844})
    pg = ctx.new_page()
    pg.goto(BASE + 'index.html', wait_until='networkidle')
    pg.locator('[data-nav-toggle]').click()
    nav_open = pg.evaluate('document.querySelector("[data-nav-toggle]").getAttribute("aria-expanded") === "true" && document.querySelector("main").inert && document.documentElement.classList.contains("is-locked")')
    pg.keyboard.press('Escape')
    nav_closed = pg.evaluate('document.querySelector("[data-nav-toggle]").getAttribute("aria-expanded") === "false" && !document.querySelector("main").inert && !document.documentElement.classList.contains("is-locked")') and active(pg, 'el => el.matches("[data-nav-toggle]")')
    pg.locator('[data-nav-toggle]').click(); pg.locator('[data-nav] a[href="#visit"]').click(); pg.wait_for_timeout(700)
    link_closes = pg.evaluate('document.querySelector("[data-nav-toggle]").getAttribute("aria-expanded") === "false"') and active(pg, 'el => el.id === "visit"')
    check('mobile nav: aria-expanded, inert + scroll lock while open, Esc closes and returns focus', nav_open and nav_closed)
    check('mobile nav: link click closes menu and focuses the section', link_closes)
    pad = pg.evaluate('parseFloat(getComputedStyle(document.body).paddingBottom)')
    barh = pg.evaluate('document.querySelector("[data-mobile-bar]").getBoundingClientRect().height')
    check('sticky bar never covers content (body padding >= bar height)', pad >= barh - 0.5, f'padding {pad}, bar {barh}')
    pg.locator('#r-name').focus(); pg.wait_for_timeout(400)
    hid = pg.evaluate('getComputedStyle(document.querySelector("[data-mobile-bar]")).visibility')
    pg.locator('#r-name').blur(); pg.wait_for_timeout(400)
    back = pg.evaluate('getComputedStyle(document.querySelector("[data-mobile-bar]")).visibility')
    check('sticky bar hides while typing on phones, returns after', hid == 'hidden' and back == 'visible', f'{hid} -> {back}')
    pg.goto(BASE + 'menu.html', wait_until='networkidle')
    add_two(pg); pg.locator('[data-mbar-cart]').click(); pg.wait_for_timeout(350)
    small = pg.evaluate('''[...document.querySelectorAll('.mbar a, .mbar button, [data-add], .qty__btn, .drawer__close, .cart-btn, .nav-toggle, .chip, .catbar__link, .cart-line__remove')]
        .filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
        .map(e => { const r = e.getBoundingClientRect(); return [e.className || e.tagName, Math.round(r.width), Math.round(r.height)]; })
        .filter(([, w, h]) => w < 44 || h < 44)''')
    check('targets >= 44x44 at 390 (bar, add, steppers, close, chips, cart, nav)', not small, str(small[:5]))
    ctx.close()

    # 5b. "Back to top" never covers content (menu end, home footer, booking fields); it still appears at the end
    OVERLAP_JS = '''(() => { const t = document.querySelector('[data-to-top]'); if (!t || t.hidden) return null;
      const r = t.getBoundingClientRect(); const out = [];
      for (const el of document.querySelectorAll('a,button,input,select,textarea,label,summary,p,h1,h2,h3,h4,li,dd,dt,td,th,address,span')) {
        if (el === t || t.contains(el) || el.closest('[data-mobile-bar],[data-header],.drawer,[hidden]')) continue;
        const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        for (const q of el.getClientRects()) { if (q.width < 1 || q.height < 1) continue;
          if (q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top) { out.push((el.tagName + '.' + el.className).slice(0, 36) + ' "' + (el.textContent || el.value || '').trim().slice(0, 24) + '"'); break; } } }
      return out; })()'''
    tt_over, tt_seen = [], {}
    for w, h in [(390, 844), (360, 640), (1024, 768), (1440, 900)]:
        ctx = br.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page()
        pg.goto(BASE + 'menu.html', wait_until='networkidle'); add_two(pg)
        for name in ['menu', 'index']:
            pg.goto(BASE + name + '.html', wait_until='networkidle')
            maxy = pg.evaluate('document.documentElement.scrollHeight - innerHeight')
            ys = list(range(0, maxy, max(120, h // 3))) + [maxy - 30, maxy]
            seen = 0
            for y in ys:
                pg.evaluate(f'window.scrollTo({{top: {y}, behavior: "instant"}})'); pg.wait_for_timeout(90)
                o = pg.evaluate(OVERLAP_JS)
                if o is None: continue
                seen += 1
                if o: tt_over.append(f'{name}@{w} y={y}: {o[:3]}')
            tt_seen[f'{name}@{w}'] = seen
        ctx.close()
    check('back-to-top never overlaps content (menu end, home footer, booking fields) at 390, 360, 1024, 1440',
          not tt_over and all(v > 0 for v in tt_seen.values()), ('; '.join(tt_over[:4]) or 'ok') + f' | shown at {tt_seen}')

    # 5e. accessible names: cart button keeps "<word>, N items" at 360 and 320; CSS symbols are not announced
    def ax_name(page, handle):
        snap = page.accessibility.snapshot(root=handle, interesting_only=False)
        return (snap or {}).get('name', '')
    bad_names, seen_names = [], []
    for w, h in [(360, 640), (320, 640)]:
        ctx = br.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page()
        pg.goto(BASE + 'menu.html', wait_until='networkidle'); add_two(pg)
        for name in ['index', 'menu', 'checkout']:
            pg.goto(BASE + name + '.html', wait_until='networkidle')
            for el in pg.query_selector_all('[data-cart-open]'):
                if not el.is_visible() or not el.query_selector('[data-cart-count]') or el.get_attribute('data-mbar-cart') is not None: continue
                word = (el.get_attribute('data-cart-word') or 'cart').lower()
                nm = ax_name(pg, el)
                seen_names.append(nm)
                if word not in nm.lower() or '2' not in nm: bad_names.append(f'{name}@{w}: {nm!r}')
        ctx.close()
    check('cart button accessible name keeps its word and count at 360 and 320 (all pages)', seen_names and not bad_names,
          '; '.join(bad_names[:4]) or f'e.g. {seen_names[0]!r}, {len(seen_names)} buttons')
    ctx = br.new_context(viewport={'width': 1440, 'height': 900}); pg = ctx.new_page()
    pg.goto(BASE + 'menu.html', wait_until='networkidle'); add_two(pg)
    pg.locator('[data-filter]').first.click()
    chip_nm = ax_name(pg, pg.query_selector('[data-filter][aria-pressed=true]'))
    pg.goto(BASE + 'checkout.html', wait_until='networkidle')
    tog = pg.query_selector('[data-summary-details] > summary')
    tog_nm = ax_name(pg, tog) if tog else ''
    syms = ['+', '−', '✓']
    check('CSS-generated symbols not announced (summary toggle, pressed chip)', not any(s in tog_nm + chip_nm for s in syms), f'{tog_nm!r} / {chip_nm!r}')
    ctx.close()

    # 5f. after an order, the next order starts clean: default tip, no notes, ASAP/schedule back to default
    ctx = br.new_context(viewport={'width': 1440, 'height': 900}); pg = ctx.new_page()
    pg.goto(BASE + 'menu.html', wait_until='networkidle'); add_two(pg)
    pg.locator('.cart-btn').first.click(); pg.wait_for_timeout(300)
    pg.locator('.cart-line__note summary').first.click(); pg.locator('.cart-line__note input').first.fill('no onions'); pg.keyboard.press('Tab')
    pg.keyboard.press('Escape')
    pg.goto(BASE + 'checkout.html', wait_until='networkidle')
    default_tip = pg.locator('input[name=tip]:checked').get_attribute('value')
    other = [r.get_attribute('value') for r in pg.query_selector_all('input[name=tip]') if r.get_attribute('value') != default_tip]
    if other: pg.locator(f'input[name=tip][value="{other[-1]}"]').check(force=True)
    pg.check('#when-later')
    pg.fill('#c-name', 'Tip Test'); pg.fill('#c-phone', '5555550100'); pg.click('[data-place-order]')
    placed = pg.locator('[data-confirmation]').is_visible()
    pg.goto(BASE + 'menu.html', wait_until='networkidle'); add_two(pg)
    pg.goto(BASE + 'checkout.html', wait_until='networkidle')
    tip_after = pg.locator('input[name=tip]:checked').get_attribute('value')
    notes_left = pg.evaluate('JSON.stringify(Object.assign({}, localStorage))').count('no onions')
    asap_default = pg.locator('#when-asap').is_checked() or not pg.locator('#when-asap').is_enabled()
    check('next order starts clean: tip back to default, notes cleared, time choice reset', placed and bool(other) and tip_after == default_tip and notes_left == 0 and asap_default,
          f'default {default_tip}, chose {other[-1] if other else None}, after {tip_after}, notes left {notes_left}, asap default {asap_default}')
    ctx.close()

    # 5d. validation lists ALL errors together, uses a fitting too-short message, and the summary never goes stale
    ctx = br.new_context(viewport={'width': 1440, 'height': 900}); pg = ctx.new_page()
    pg.goto(BASE + 'menu.html', wait_until='networkidle'); add_two(pg)
    vres = {}
    for page, pre, submit in [('index', 'r', '#reserve-form button[type=submit]'), ('checkout', 'c', '[data-place-order]')]:
        for mode in ['one-pass', 'after-empty-submit']:
            pg.goto(BASE + page + '.html', wait_until='networkidle')
            if mode == 'after-empty-submit':
                pg.click(submit)
            for fid, val in [('name', 'A'), ('phone', '12'), ('email', 'bad@')]:
                pg.fill(f'#{pre}-{fid}', val); pg.press(f'#{pre}-{fid}', 'Tab')
            if mode == 'one-pass':
                pg.click(submit)
            items = pg.locator('[data-error-summary] li').all_inner_texts() if pg.locator('[data-error-summary]').is_visible() else []
            name_msg = pg.locator(f'#{pre}-name-error').inner_text() if pg.locator(f'#{pre}-name-error').count() else ''
            vres[f'{page}/{mode}'] = (len(items) == 3 and any('email' in x for x in items) and not any('Enter your name' in x for x in items) and 'too short' in name_msg, items, name_msg)
    check('validation: name+phone+email errors listed together; summary updates live after a failed submit',
          all(v[0] for v in vres.values()), '; '.join(f'{k}: {len(v[1])} items' for k, v in vres.items()))
    check('validation: one-letter name says "looks too short", not "Enter your name"', all('too short' in v[2] for v in vres.values()), vres['index/one-pass'][2])
    ctx.close()

    # 5c. checkout time line follows the scheduled slot and the ASAP/schedule switch
    ctx = br.new_context(viewport={'width': 390, 'height': 844}); pg = ctx.new_page()
    pg.goto(BASE + 'menu.html', wait_until='networkidle'); add_two(pg)
    pg.goto(BASE + 'checkout.html', wait_until='networkidle')
    pg.check('#when-later')
    n_opts = pg.locator('#c-slot option').count()
    picks = []
    for idx in [min(3, n_opts - 1), min(6, n_opts - 1)]:
        pg.select_option('#c-slot', index=idx)
        lab = pg.locator('#c-slot option:checked').inner_text()
        est = pg.locator('[data-ready-estimate]').inner_text()
        picks.append((lab in est, lab, est))
    asap_ok = True
    if pg.locator('#when-asap').is_enabled():
        pg.check('#when-asap'); asap_ok = 'about' in pg.locator('[data-ready-estimate]').inner_text()
    check('checkout: time line updates on slot change and on ASAP/schedule switch', n_opts > 1 and all(x[0] for x in picks) and asap_ok,
          '; '.join(f'{x[1]} -> "{x[2]}"' for x in picks) + f'; asap ok {asap_ok}')
    ctx.close()

    # 6. menu search, filters, empty state, scroll-spy, JSON-LD
    ctx = br.new_context(viewport={'width': 1440, 'height': 900})
    pg = ctx.new_page()
    pg.goto(BASE + 'menu.html', wait_until='networkidle')
    pg.fill('[data-menu-search]', 'zzzz'); pg.wait_for_timeout(400)
    empty_ok = pg.locator('[data-menu-empty]').is_visible() and 'No dishes' in pg.locator('[data-menu-status]').inner_text()
    pg.locator('[data-menu-clear]').click(); pg.wait_for_timeout(300)
    total_txt = pg.locator('[data-menu-status]').inner_text()
    chip = pg.locator('[data-filter]').first; chip.click(); pg.wait_for_timeout(300)
    filt_txt = pg.locator('[data-menu-status]').inner_text(); chip.click()
    check('menu: search empty state + live status, clear, chip filter', empty_ok and 'all' in total_txt and 'of' in filt_txt, f'{total_txt} / {filt_txt}')
    last = pg.locator('.menu-cat').last.get_attribute('id')
    pg.evaluate(f'document.getElementById("{last}").scrollIntoView({{behavior: "instant"}})'); pg.wait_for_timeout(500)
    cur = pg.evaluate('document.querySelector("[data-cat-link][aria-current=true]")?.dataset.catLink')
    check('menu: scroll-spy sets aria-current on the visible category', cur == last, f'{cur} vs {last}')
    ld = pg.evaluate('[...document.querySelectorAll("script[type=\'application/ld+json\']")].map(s => s.textContent)')
    try:
        parsed = [json.loads(x) for x in ld]
        sec = parsed[0]['hasMenu']['hasMenuSection']
        ld_ok = parsed[0]['@type'] == 'Restaurant' and 'SAMPLE' in parsed[0]['description'] and sum(len(s['hasMenuItem']) for s in sec) > 0
        info = f'{len(sec)} sections, {sum(len(s["hasMenuItem"]) for s in sec)} items'
    except Exception as e:
        ld_ok, info = False, str(e)
    check('JSON-LD Restaurant/Menu is valid JSON and marked sample', ld_ok, info)
    blank = ctx.new_page(); blank.goto(ORIGIN + '/serve.py')
    base_keys = set(blank.evaluate('Object.keys(window)')); blank.close()
    leaks = sorted(set(pg.evaluate('Object.keys(window)')) - base_keys)
    check('no globals beyond window.SITE', leaks == ['SITE'], str(leaks))
    ctx.close()

    # 7. open-now logic with a fixed clock (template hours; skipped on other sites)
    if args.site == '_template':
        cases = {'2026-11-02T12:00:00': 'opens tomorrow', '2026-11-03T21:00:00': 'Closing soon', '2026-11-07T23:50:00': 'until 12:30',
                 '2026-11-08T00:10:00': 'until 12:30', '2026-11-08T09:00:00': 'opens today at 10:00', '2026-11-04T14:00:00': 'Open now'}
        got = {}
        for t, want in cases.items():
            c = br.new_context(viewport={'width': 1440, 'height': 900}); pg = c.new_page()
            pg.clock.set_fixed_time(t)
            pg.goto(BASE + 'index.html', wait_until='networkidle')
            txt = pg.locator('[data-open-status]').first.inner_text()
            today = pg.locator('.hours .is-today th').inner_text()
            got[t] = (want in txt, txt.replace('\n', ' '), today.split()[0])
            c.close()
        check('open-now: closed day, closing soon, overnight (Sat->Sun), opens today, open; sample flag', all(v[0] for v in got.values()) and all('sample' in v[1] for v in got.values()), '; '.join(f'{k[5:16]} {v[1]} ({v[2]})' for k, v in got.items()))

    # 8. storage blocked + cross-tab sync + card data never stored
    ctx = br.new_context(viewport={'width': 390, 'height': 844})
    ctx.add_init_script("Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });")
    pg = ctx.new_page(); errs = []; watch(pg, errs)
    pg.goto(BASE + 'menu.html', wait_until='networkidle')
    add_two(pg)
    blocked_count = pg.locator('[data-cart-count]').first.inner_text()
    pg.locator('[data-mbar-cart]').click(); pg.wait_for_timeout(300)
    lines = pg.locator('.cart-line').count()
    check('storage blocked: cart works in memory, 0 errors', blocked_count == '2' and lines == 2 and not errs, f'count {blocked_count}, lines {lines}, errs {errs[:2]}')
    ctx.close()
    ctx = br.new_context(viewport={'width': 1440, 'height': 900})
    a, b = ctx.new_page(), ctx.new_page()
    a.goto(BASE + 'menu.html', wait_until='networkidle'); b.goto(BASE + 'index.html', wait_until='networkidle')
    add_two(a); b.wait_for_timeout(400)
    check('cart syncs across tabs (storage event)', b.locator('[data-cart-count]').first.inner_text() == '2')
    a.goto(BASE + 'checkout.html', wait_until='networkidle')
    a.check('#pay-card')
    a.fill('#c-name', 'Card Test'); a.fill('#c-phone', '5555550100')
    a.fill('#c-ccname', 'Card Test'); a.fill('#c-ccnumber', '4111111111111111'); a.fill('#c-ccexp', '12/30'); a.fill('#c-cccsc', '123')
    a.click('[data-place-order]')
    dump = a.evaluate('JSON.stringify(Object.assign({}, localStorage)) + JSON.stringify(Object.assign({}, sessionStorage)) + document.cookie')
    fields_empty = a.evaluate('[...document.querySelectorAll("[data-card-fields] input")].every(i => !i.value)')
    check('card data never stored (storage/cookies) and fields wiped', '4111' not in dump and fields_empty and a.locator('[data-confirmation]').is_visible())
    # delivery mode adds the fee; wallet demo button
    a.goto(BASE + 'menu.html', wait_until='networkidle'); add_two(a)
    a.goto(BASE + 'checkout.html', wait_until='networkidle')
    t1 = a.locator('[data-summary-total]').inner_text()
    a.check('#mode-delivery'); t2 = a.locator('[data-summary-total]').inner_text()
    fee = a.locator('.osum .totals').inner_text()
    a.fill('#c-name', 'Wal Let'); a.fill('#c-phone', '5555550100'); a.fill('#c-address1', '[street]'); a.fill('#c-postcode', '00000')
    a.click('[data-wallet]')
    min_msg = a.locator('[data-error-summary]').inner_text() if a.locator('[data-error-summary]').is_visible() else ''
    if a.locator('[data-confirmation]').is_hidden():
        # under the sample delivery minimum: add more through the drawer and retry
        a.click('[data-edit-order]'); a.wait_for_timeout(300)
        for _ in range(2): a.locator('.cart-line [data-action="inc"]').first.click()
        a.keyboard.press('Escape'); a.wait_for_timeout(300)
        a.click('[data-wallet]')
    pay = a.locator('[data-conf-pay]').inner_text() if a.locator('[data-confirmation]').is_visible() else ''
    check('delivery adds fee; delivery minimum enforced; wallet demo button places demo order', t1 != t2 and 'Delivery fee' in fee and 'demo' in pay,
          f'{t1} -> {t2}; min msg: {min_msg[:80]!r}; {pay}')
    ctx.close()

    # 9. reduced motion
    ctx = br.new_context(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
    pg = ctx.new_page()
    pg.goto(BASE + 'menu.html', wait_until='networkidle')
    rm = pg.evaluate('''(() => { const p = document.querySelector('.drawer__panel'); return [getComputedStyle(document.documentElement).scrollBehavior, getComputedStyle(p).transitionDuration]; })()''')
    check('reduced motion: no smooth scroll, drawer transition ~0', rm[0] == 'auto' and all(float(x.rstrip('s')) < 0.02 for x in rm[1].split(',')), str(rm))
    pg.goto(BASE + 'checkout.html', wait_until='networkidle')
    check('checkout with empty cart shows the empty state, hides the form', pg.locator('[data-checkout-empty]').is_visible() and pg.locator('[data-checkout-root]').is_hidden())
    ctx.close()

    # 10. axe-core (names, contrast, ARIA) at 1440 and 390, pages + drawer open + menu nav open
    if os.path.exists(AXE):
        viol = {}
        for w, h in [(1440, 900), (390, 844)]:
            ctx = br.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page()
            pg.goto(BASE + 'menu.html', wait_until='networkidle'); add_two(pg)
            for name, setup in [('index', None), ('menu', None), ('checkout', None), ('menu+drawer', 'drawer'), ('index+nav', 'nav')]:
                pg.goto(BASE + name.split('+')[0] + '.html', wait_until='networkidle')
                if setup == 'drawer': pg.locator('.cart-btn').click(); pg.wait_for_timeout(400)
                if setup == 'nav':
                    if w > 900: continue
                    pg.locator('[data-nav-toggle]').click()
                pg.add_script_tag(path=AXE)
                # with the mobile nav open, main is inert (modal state), so the main/h1 page rules do not apply
                rules = '{ "landmark-one-main": { enabled: false }, "page-has-heading-one": { enabled: false } }' if setup == 'nav' else '{}'
                r = pg.evaluate('axe.run(document, { rules: ' + rules + ', runOnly: { type: "tag", values: ["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa","best-practice"] } }).then(r => r.violations.map(v => v.id + " x" + v.nodes.length + " " + v.nodes.slice(0,2).map(n => n.target.join(" ")).join(" | ")))')
                if r: viol[f'{name}@{w}'] = r
            ctx.close()
        data['axe'] = viol
        check('axe-core: 0 violations (WCAG 2.2 AA + best practice incl. contrast, names)', not viol, json.dumps(viol)[:600])
    else:
        check('axe-core available', False, 'axe.min.js not found; skipped')

    br.close()

# 11. sizes
sizes = {}
for f in ['shared/core.js', 'shared/base.css']:
    raw = open(os.path.join(V2, f), 'rb').read()
    sizes[f] = {'bytes': len(raw), 'gzip': len(gzip.compress(raw, 9))}
data['sizes'] = sizes
check('base.css under ~25 KB unminified', sizes['shared/base.css']['bytes'] < 25600, str(sizes))
src = open(os.path.join(V2, 'shared/core.js'), encoding='utf-8').read()
check('core.js has no console.log / no window.* exports', 'console.' not in src and not re.search(r'window\.(?!SITE\b)\w+\s*=', src))

data['results'] = results
out = os.path.join(HERE, f'core_smoke_{args.site.strip("_") or "template"}.json')
json.dump(data, open(out, 'w', encoding='utf-8'), indent=2)
fails = [r for r in results if not r['ok']]
print(f'\n{len(results) - len(fails)}/{len(results)} checks passed. Details: {out}')
sys.exit(1 if fails else 0)
