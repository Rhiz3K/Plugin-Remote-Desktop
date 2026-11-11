import json, time
from playwright.sync_api import sync_playwright
res = {}
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    for v in ["base", "branch"]:
        ctx = b.new_context(viewport={"width": 390, "height": 760}, device_scale_factor=3, is_mobile=True, has_touch=True)
        pg = ctx.new_page(); pg.goto(f"file:///workspace/cli-test/vnc-web/harness/out-focus-{v}/index.html")
        cdp = ctx.new_cdp_session(pg)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": 150, "y": 150, "id": 0}]})
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        time.sleep(0.1)
        pg.evaluate("openSoftKeyboard()")
        time.sleep(0.5)
        active = pg.evaluate("document.activeElement.id || document.activeElement.tagName")
        res[v] = {"final_active": active, "log": pg.evaluate("focusLog")}
        pg.screenshot(path=f"/workspace/cli-test/vnc-web/harness/{v}-6-tap-then-keyboard.png")
        ctx.close()
    b.close()
json.dump(res, open("/workspace/cli-test/vnc-web/harness/results-focus.json", "w"), indent=1)
for v in res: print(v, res[v]["final_active"], [(e["t"] - res[v]["log"][0]["t"], e["what"], e["active"]) for e in res[v]["log"]])
