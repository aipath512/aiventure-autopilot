import subprocess, time, sys
from playwright.sync_api import sync_playwright
site, = sys.argv[1:2]
srv = subprocess.Popen(['node','tests/mock_server.mjs',site,'8799']); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox']); pg = b.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        pg.goto('http://localhost:8799/'); pg.fill('#url','https://firmsfinder.eu/aeo/'); pg.click('#go')
        pg.wait_for_selector('#iter:not([hidden])', timeout=8000)
        n=0
        while pg.is_visible('#iter') and n<20:
            n+=1; title=pg.inner_text('#iterTitle'); est=pg.inner_text('#sEst')
            if pg.is_visible('#files'): pg.click('#assumeBtn'); pg.wait_for_timeout(300)
            if pg.is_visible('#needs input[data-key=license]'): pg.fill('#in_license','https://creativecommons.org/licenses/by/4.0/')
            print(f'{title:60s} estimat {est}'); pg.click('#approve'); pg.wait_for_timeout(500)
        print('FINAL estimat', pg.inner_text('#sEst'), '|', pg.inner_text('#doneTitle'))
        print('chips:', pg.inner_text('#chips').replace('\n',' | ')[:200])
        with pg.expect_download() as d: pg.click('#dlHtml')
        print('descărcat:', d.value.suggested_filename)
        print('erori JS:', errs or 'niciuna'); b.close()
finally: srv.terminate()
