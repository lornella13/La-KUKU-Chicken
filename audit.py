"""READ-ONLY audit of the rendered page for leftover placeholder content.

Changes nothing. Loads the page, walks every section, and reports any
placeholder-style text, empty fields, broken images, dead links or empty
sections. Usage: python3 audit.py http://localhost:5173
"""

import asyncio, json, subprocess, sys, time, urllib.request, websockets

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173"

JS = r"""
(async () => {
  window.scrollTo(0, document.body.scrollHeight);
  await new Promise(r => setTimeout(r, 2500));
  window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 500));
  await Promise.all([...document.images].filter(i => !i.complete)
    .map(i => new Promise(r => { i.onload = i.onerror = r; })));

  const PATTERNS = [
    ['[Placeholder ...]', /\[placeholder/i],
    ['[e.g. ...]',         /\[\s*e\.g\./i],
    ['To be confirmed',    /to be confirmed/i],
    ['For the shop owner', /shop owner|founding story/i],
    ['TODO/FIXME',         /\b(todo|fixme|xxx)\b/i],
    ['Lorem ipsum',        /lorem ipsum/i],
    ['coming soon',        /coming soon/i],
    ['example/dummy',      /\b(example|dummy|sample)\b/i],
    ['undefined/null/NaN', /\b(undefined|NaN|\[object)\b/],
  ];

  const hits = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const txt = (node.textContent || '').trim();
    if (!txt) continue;
    for (const [label, re] of PATTERNS) {
      if (re.test(txt)) {
        hits.push({label, text: txt.slice(0, 120),
                   where: node.parentElement.tagName.toLowerCase() +
                          (node.parentElement.className ? '.' + String(node.parentElement.className).split(' ')[0] : '')});
      }
    }
  }

  // empty-ish content blocks
  const empties = [];
  for (const sel of ['.p-desc', '.cat-blurb', '.why-card p', '.story-card p',
                     '.loc-row p', '.story-copy p', 'figcaption', '.value', '.hint']) {
    document.querySelectorAll(sel).forEach(el => {
      if (!el.innerText.trim()) empties.push(sel);
    });
  }

  // images + links
  const brokenImg = [...document.images]
    .filter(i => !i.complete || !i.naturalWidth)
    .map(i => i.getAttribute('src'));
  const emptyAlt = [...document.images]
    .filter(i => !(i.getAttribute('alt') || '').trim())
    .map(i => i.getAttribute('src'));
  const links = [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href'));
  const deadLinks = [...new Set(links.filter(h => !h || h === '#' || h === 'undefined'))];
  const hashes = [...new Set(links.filter(h => h.startsWith('#')).map(h => h.slice(1)))];
  const brokenAnchors = hashes.filter(id => id && !document.getElementById(id));

  // sections present
  const sections = [...document.querySelectorAll('section[id]')].map(s => s.id);

  return {
    hits, empties, brokenImg, emptyAlt, deadLinks, brokenAnchors, sections,
    todoNodes: document.querySelectorAll('.todo, .todo-note').length,
    bodyLen: document.body.innerText.length,
    productCards: document.querySelectorAll('.product-card').length,
  };
})()
"""


async def rpc(ws, i, m, p=None):
    await ws.send(json.dumps({"id": i, "method": m, "params": p or {}}))
    while True:
        r = json.loads(await ws.recv())
        if r.get("id") == i:
            return r


async def main():
    c = subprocess.Popen(["google-chrome", "--headless=new", "--disable-gpu", "--no-sandbox",
        "--remote-debugging-port=9253", "--hide-scrollbars", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(2.5)
        tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9253/json").read())
        u = next(t for t in tabs if t["type"] == "page")["webSocketDebuggerUrl"]
        async with websockets.connect(u, max_size=40 * 1024 * 1024) as ws:
            await rpc(ws, 1, "Runtime.enable"); await rpc(ws, 3, "Page.enable")
            await rpc(ws, 10, "Emulation.setDeviceMetricsOverride",
                      {"width": 1440, "height": 900, "deviceScaleFactor": 1, "mobile": False})
            await rpc(ws, 11, "Page.navigate", {"url": URL}); time.sleep(4)
            r = await rpc(ws, 12, "Runtime.evaluate",
                          {"expression": JS, "returnByValue": True, "awaitPromise": True})
            v = r["result"]["result"]["value"]

            print("=" * 70)
            print("PLACEHOLDER-TEXT HITS IN RENDERED PAGE")
            print("=" * 70)
            if v["hits"]:
                for h in v["hits"]:
                    print("  [%s] in %s" % (h["label"], h["where"]))
                    print("      %r" % h["text"])
            else:
                print("  none")

            print()
            print("=" * 70)
            print("OTHER HEALTH CHECKS")
            print("=" * 70)
            print("  .todo / .todo-note nodes rendered :", v["todoNodes"])
            print("  empty text blocks                  :", v["empties"] or "none")
            print("  broken images                      :", v["brokenImg"] or "none")
            print("  images missing alt text            :", v["emptyAlt"] or "none")
            print("  dead/empty hrefs                   :", v["deadLinks"] or "none")
            print("  anchors with no target section     :", v["brokenAnchors"] or "none")
            print("  sections found                     :", v["sections"])
            print("  product cards                      :", v["productCards"])
            print("  page text length                   :", v["bodyLen"], "chars")
    finally:
        c.terminate()

asyncio.run(main())