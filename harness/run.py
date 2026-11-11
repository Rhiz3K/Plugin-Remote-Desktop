import json, sys, time
from playwright.sync_api import sync_playwright
res = {}
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    for v in ["base", "branch"]:
        ctx = b.new_context(viewport={"width": 390, "height": 760}, device_scale_factor=3, is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        pg.goto(f"file:///workspace/cli-test/vnc-web/harness/out-{v}/index.html")
        cdp = ctx.new_cdp_session(pg)
        def touch(type_, pts):
            cdp.send("Input.dispatchTouchEvent", {"type": type_, "touchPoints": [{"x": x, "y": y, "id": i} for (i, x, y) in pts]})
        r = {}
        def mark(): return len(pg.evaluate("remoteLog"))
        def since(n): return pg.evaluate("remoteLog")[n:]
        # S1: two-finger pan (both fingers move), then lift
        n = mark()
        touch("touchStart", [(0, 120, 150)]); touch("touchStart", [(0, 120, 150), (1, 220, 150)])
        for k in range(1, 9):
            touch("touchMove", [(0, 120 - 10*k, 150 - 8*k), (1, 220 - 10*k, 150 - 8*k)]); time.sleep(0.02)
        touch("touchEnd", [(1, 140, 86)]); touch("touchEnd", [])
        time.sleep(0.6)
        s1 = since(n); r["S1_pan_states"] = len(s1); r["S1_pan_presses"] = sum(1 for e in s1 if e["kind"]=="mouse" and (e["left"] or e["right"] or e["middle"]))
        pg.screenshot(path=f"/workspace/cli-test/vnc-web/harness/{v}-1-pan.png")
        # S2: pinch with first finger kept still, lift second then first, then a fresh 1-finger move within 250 ms
        n = mark()
        touch("touchStart", [(0, 150, 160)]); touch("touchStart", [(0, 150, 160), (1, 200, 200)])
        for k in range(1, 9):
            touch("touchMove", [(0, 150, 160), (1, 200 + 12*k, 200 + 12*k)]); time.sleep(0.02)
        touch("touchEnd", [(1, 296, 296)]); touch("touchEnd", [])
        time.sleep(0.05)
        touch("touchStart", [(2, 160, 170)])
        for k in range(1, 9):
            touch("touchMove", [(2, 160 + 15*k, 170 + 10*k)]); time.sleep(0.02)
        touch("touchEnd", [])
        time.sleep(0.6)
        s2 = since(n)
        r["S2_left_states"] = sum(1 for e in s2 if e["kind"]=="mouse" and e["left"])
        r["S2_drag_moves"] = sum(1 for e in s2 if e["kind"]=="mouse" and e["left"] and (e["x"], e["y"]) != (s2[0]["x"], s2[0]["y"])) if s2 else 0
        r["S2_states"] = s2[:40]; r["S2_raw"] = pg.evaluate("rawLog")
        pg.screenshot(path=f"/workspace/cli-test/vnc-web/harness/{v}-2-pinch-then-move.png")
        # S3: a plain tap still clicks
        n = mark()
        touch("touchStart", [(3, 100, 100)]); touch("touchEnd", []); time.sleep(0.5)
        s3 = since(n); r["S3_tap_left_presses"] = sum(1 for e in s3 if e["kind"]=="mouse" and e["left"])
        # S4: held Backspace (1 press + 5 autorepeats) on the textarea
        pg.focus("#kbd"); n = mark()
        for _ in range(6): pg.keyboard.down("Backspace"); time.sleep(0.03)
        pg.keyboard.up("Backspace"); time.sleep(0.1)
        s4 = since(n)
        r["S4_backspace_downs"] = sum(1 for e in s4 if e["kind"]=="key" and e["pressed"]==1)
        r["S4_backspace_ups"] = sum(1 for e in s4 if e["kind"]=="key" and e["pressed"]==0)
        pg.screenshot(path=f"/workspace/cli-test/vnc-web/harness/{v}-3-backspace.png")
        # S5: touchpad mode, quick pinch then a fresh 1 px move within 250 ms
        pg.goto(f"file:///workspace/cli-test/vnc-web/harness/out-{v}/index.html?mode=touchpad"); cdp = ctx.new_cdp_session(pg)
        touch("touchStart", [(0, 60, 60)]); touch("touchMove", [(0, 120, 120)]); touch("touchEnd", []); time.sleep(0.4)
        n = mark()
        touch("touchStart", [(0, 60, 60)]); touch("touchStart", [(0, 60, 60), (1, 100, 100)])
        touch("touchMove", [(0, 60, 60), (1, 110, 110)]); touch("touchEnd", [(1, 110, 110)]); touch("touchEnd", [])
        time.sleep(0.05)
        touch("touchStart", [(2, 340, 300)]); touch("touchMove", [(2, 341, 300)]); touch("touchEnd", [(2, 341, 300)]); time.sleep(0.6)
        all5 = pg.evaluate("remoteLog"); s5 = all5[n:]
        prev = [e for e in all5[:n] if e["kind"]=="mouse"]
        p0 = (prev[-1]["x"], prev[-1]["y"]) if prev else (0, 0)
        jumps = []
        for e in s5:
            if e["kind"] != "mouse": continue
            jumps.append(abs(e["x"]-p0[0]) + abs(e["y"]-p0[1])); p0 = (e["x"], e["y"])
        r["S5_touchpad_max_jump_px"] = max(jumps) if jumps else 0
        r["S5_touchpad_states"] = s5
        pg.screenshot(path=f"/workspace/cli-test/vnc-web/harness/{v}-4-touchpad-jump.png")
        # S6: touchscreen, cancelled pinch, fresh touch held 350 ms (old long-press due 500 ms after the first finger)
        pg.goto(f"file:///workspace/cli-test/vnc-web/harness/out-{v}/index.html"); cdp = ctx.new_cdp_session(pg)
        n = mark()
        touch("touchStart", [(0, 80, 80)]); touch("touchStart", [(0, 80, 80), (1, 160, 160)]); time.sleep(0.1)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchCancel", "touchPoints": []}); time.sleep(0.1)
        touch("touchStart", [(2, 250, 250)]); time.sleep(0.35); touch("touchMove", [(2, 330, 330)]); touch("touchEnd", []); time.sleep(0.3)
        s6 = since(n)
        r["S6_cancel_right_clicks"] = sum(1 for e in s6 if e["kind"]=="mouse" and e["right"])
        r["S6_states"] = s6
        pg.screenshot(path=f"/workspace/cli-test/vnc-web/harness/{v}-5-cancelled-pinch.png")
        res[v] = r
        ctx.close()
    b.close()
json.dump(res, open("/workspace/cli-test/vnc-web/harness/results.json", "w"), indent=1)
for v in res:
    print(v, {k: x for k, x in res[v].items() if not k.endswith(("_states","_raw"))})
