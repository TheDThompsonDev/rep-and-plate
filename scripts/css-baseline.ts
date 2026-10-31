/**
 * Computed-style baseline for behavior-preserving CSS refactors.
 *
 *   npx tsx scripts/css-baseline.ts snapshot <out.json> [--shots <dir>] [--base http://127.0.0.1:5173]
 *   npx tsx scripts/css-baseline.ts diff <before.json> <after.json> [--out <diff.json>]
 *
 * `snapshot` loads the web app as a returning guest (the same seed as
 * tests/app-fixture.ts), opens Chat, Nutrition, Workouts, Kitchen and You at
 * 320, 390 and 1440 px, and records getComputedStyle for a fixed property set
 * on every element that carries a class, keyed by a DOM path. With --shots it
 * also saves viewport screenshots of Chat and Nutrition at each width.
 * `diff` compares two snapshots and exits 1 when any element or property differs.
 *
 * It is a tool, not a spec: it never runs under the Playwright test runner and
 * only uses the existing dev server (it does not start or stop one).
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { initialState } from "../src/domain";

const PAGES = ["Chat", "Nutrition", "Workouts", "Kitchen", "You"] as const;
const WIDTHS = [320, 390, 1440] as const;
const SHOT_PAGES = new Set<string>(["Chat", "Nutrition"]);
const PROPS = [
  "color",
  "background-color",
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
  "display",
  "row-gap",
  "column-gap",
];

/* Passed to page.evaluate as source text (an IIFE with the property list
 * inlined): tsx's keepNames transform would otherwise inject a `__name` helper
 * that does not exist in the page, and Playwright evaluates a string as an
 * expression rather than calling it. */
const COLLECT = `((props) => {
  const pathOf = (start) => {
    const parts = [];
    let el = start;
    while (el && el !== document.documentElement) {
      const parent = el.parentElement;
      let index = 1;
      if (parent) {
        let seen = 0;
        for (const sibling of Array.from(parent.children)) {
          if (sibling.tagName === el.tagName) {
            seen += 1;
            if (sibling === el) { index = seen; break; }
          }
        }
      }
      const classes = (el.getAttribute("class") || "").trim().split(/\\s+/).filter(Boolean).sort().join(".");
      parts.unshift(el.tagName.toLowerCase() + (classes ? "." + classes : "") + ":" + index);
      el = parent;
    }
    return parts.join("/");
  };
  const out = {};
  for (const el of Array.from(document.querySelectorAll("[class]"))) {
    const computed = getComputedStyle(el);
    const record = {};
    for (const prop of props) record[prop] = computed.getPropertyValue(prop);
    out[pathOf(el)] = record;
  }
  return out;
})(${JSON.stringify(PROPS)})`;

type Styles = Record<string, string>;
type PageSnapshot = Record<string, Styles>;
type Snapshot = {
  meta: { createdAt: string; base: string; props: string[] };
  pages: Record<string, PageSnapshot>;
};

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function snapshot(out: string) {
  const base = arg("--base") ?? "http://127.0.0.1:5173";
  const shots = arg("--shots");
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const result: Snapshot = {
    meta: { createdAt: new Date().toISOString(), base, props: PROPS },
    pages: {},
  };
  try {
    for (const width of WIDTHS) {
      const mobile = width < 768;
      const context = await browser.newContext({
        baseURL: base,
        viewport: { width, height: mobile ? 844 : 1000 },
        isMobile: mobile,
        hasTouch: mobile,
        reducedMotion: "reduce",
      });
      await context.route("**/api/status", (route) =>
        route.fulfill({ json: { available: false, jev: false } }),
      );
      await context.addInitScript((state) => {
        if (!localStorage.getItem("fuel.prototype.v1"))
          localStorage.setItem("fuel.prototype.v1", JSON.stringify(state));
        if (!localStorage.getItem("rep-and-plate.onboarding.v1"))
          localStorage.setItem(
            "rep-and-plate.onboarding.v1",
            JSON.stringify({ version: 1, mode: "guest", focus: "A little of both" }),
          );
      }, initialState());
      for (const name of PAGES) {
        const page = await context.newPage();
        await page.goto(`/#${name.toLowerCase()}`);
        await page
          .locator(`nav[aria-label="${name} navigation"]`)
          .waitFor({ state: "attached", timeout: 15000 });
        await page.waitForLoadState("networkidle");
        await page.evaluate(() => document.fonts.ready);
        // Hydration from IndexedDB can finish after networkidle; wait until two
        // consecutive snapshots agree so `margin: auto` and friends are settled.
        let styles = (await page.evaluate(COLLECT)) as PageSnapshot;
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await page.waitForTimeout(400);
          const next = (await page.evaluate(COLLECT)) as PageSnapshot;
          const same = JSON.stringify(next) === JSON.stringify(styles);
          styles = next;
          if (same) break;
        }
        result.pages[`${name}@${width}`] = styles;
        if (shots && SHOT_PAGES.has(name)) {
          await page.screenshot({
            path: path.join(shots, `${name.toLowerCase()}-${width}.png`),
          });
        }
        process.stderr.write(
          `${name}@${width}: ${Object.keys(styles).length} elements\n`,
        );
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result, null, 1));
  process.stderr.write(`wrote ${out}\n`);
}

function diff(beforePath: string, afterPath: string, out?: string) {
  const before = JSON.parse(fs.readFileSync(beforePath, "utf8")) as Snapshot;
  const after = JSON.parse(fs.readFileSync(afterPath, "utf8")) as Snapshot;
  const report: Record<
    string,
    {
      elementsBefore: number;
      elementsAfter: number;
      removed: string[];
      added: string[];
      changed: { path: string; prop: string; before: string; after: string }[];
    }
  > = {};
  let total = 0;
  for (const key of new Set([...Object.keys(before.pages), ...Object.keys(after.pages)])) {
    const a = before.pages[key] ?? {};
    const b = after.pages[key] ?? {};
    const removed = Object.keys(a).filter((k) => !(k in b));
    const added = Object.keys(b).filter((k) => !(k in a));
    const changed: { path: string; prop: string; before: string; after: string }[] = [];
    for (const elementPath of Object.keys(a)) {
      if (!(elementPath in b)) continue;
      for (const prop of before.meta.props) {
        if (a[elementPath][prop] !== b[elementPath][prop])
          changed.push({
            path: elementPath,
            prop,
            before: a[elementPath][prop],
            after: b[elementPath][prop],
          });
      }
    }
    report[key] = {
      elementsBefore: Object.keys(a).length,
      elementsAfter: Object.keys(b).length,
      removed,
      added,
      changed,
    };
    total += removed.length + added.length + changed.length;
    console.log(
      `${key}: ${Object.keys(a).length} -> ${Object.keys(b).length} elements, ` +
        `${removed.length} removed, ${added.length} added, ${changed.length} property changes`,
    );
    for (const c of changed.slice(0, 20))
      console.log(`  ${c.prop}: ${JSON.stringify(c.before)} -> ${JSON.stringify(c.after)}  @ ${c.path.split("/").slice(-3).join("/")}`);
    for (const r of removed.slice(0, 5)) console.log(`  removed ${r.split("/").slice(-3).join("/")}`);
    for (const r of added.slice(0, 5)) console.log(`  added ${r.split("/").slice(-3).join("/")}`);
  }
  if (out) fs.writeFileSync(out, JSON.stringify(report, null, 1));
  console.log(total === 0 ? "NO DIFFERENCES" : `${total} DIFFERENCES`);
  process.exitCode = total === 0 ? 0 : 1;
}

const [mode, a, b] = process.argv.slice(2);
if (mode === "snapshot" && a) snapshot(a).catch((error) => {
  console.error(error);
  process.exit(1);
});
else if (mode === "diff" && a && b) diff(a, b, arg("--out"));
else {
  console.error("usage: css-baseline.ts snapshot <out.json> [--shots <dir>] | diff <before.json> <after.json> [--out <diff.json>]");
  process.exit(2);
}
