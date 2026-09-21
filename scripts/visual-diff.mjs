// Visual screenshot-diff: app (Next) vs PNGs de referência, claro/escuro.
// Fase 6 do plano de conversão de Design System. Saída em docs/design_system/_diff/.
//
// Ground truth = PNGs renderizados em docs/design_system/pages/tela-*-{claro,escuro}.png
// (o protótipo HTML é React-via-CDN e não renderiza de forma estável em headless).
//
// Uso:
//   1. Subir app:  npm run dev   (porta 3000)
//   2. Exportar cookie de sessão em APP_COOKIE (rotas autenticadas).
//   3. node scripts/visual-diff.mjs
//
// Env:
//   APP_URL    (default http://localhost:3000)
//   APP_COOKIE (opcional) "nome=valor; ..." — sessão p/ rotas autenticadas
//   ONLY       (opcional) "login" | "dashboard" | "alunos"
//   THRESHOLD  (default 2) — % máximo de pixels divergentes para PASS
//
// Nota: o app consome dados reais (Supabase) e o PNG usa mock — divergência de
// CONTEÚDO é esperada. A meta é layout/estilo. Use as imagens .diff.png para
// inspecionar se a divergência é de conteúdo (aceitável) ou de design (corrigir).

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import puppeteer from "puppeteer";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const THRESHOLD = Number(process.env.THRESHOLD ?? 2);
const OUT_DIR = path.resolve("docs/design_system/_diff");
const REF_DIR = path.resolve("docs/design_system/pages");

// Mapa: rota do app → arquivo-base do PNG de referência (sufixo -claro/-escuro).
const SCREENS = [
  { key: "login", app: "/login", ref: "tela-login", auth: false },
  { key: "dashboard", app: "/", ref: "tela-dashboard", auth: true },
  { key: "alunos", app: "/alunos", ref: "tela-aluno", auth: true },
];

const THEMES = [
  { name: "light", suffix: "claro" },
  { name: "dark", suffix: "escuro" },
];

function parseCookies(raw, url) {
  if (!raw) return [];
  const domain = new URL(url).hostname;
  return raw
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const i = c.indexOf("=");
      return { name: c.slice(0, i), value: c.slice(i + 1), domain, path: "/" };
    });
}

function readRef(file) {
  return PNG.sync.read(fs.readFileSync(file));
}

async function shootApp(page, url, theme, width, height) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument((t) => {
    try {
      localStorage.setItem("theme", t);
      if (t === "dark") document.documentElement.dataset.theme = "dark";
      else delete document.documentElement.dataset.theme;
    } catch {}
  }, theme);
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
  await page.evaluate((t) => {
    if (t === "dark") document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
  }, theme);
  await new Promise((r) => setTimeout(r, 800));
  const buf = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width, height } });
  return PNG.sync.read(buf);
}

function cropToCommon(a, b) {
  const w = Math.min(a.width, b.width);
  const h = Math.min(a.height, b.height);
  const crop = (img) => {
    if (img.width === w && img.height === h) return img;
    const out = new PNG({ width: w, height: h });
    PNG.bitblt(img, out, 0, 0, w, h, 0, 0);
    return out;
  };
  return [crop(a), crop(b), w, h];
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const cookies = parseCookies(process.env.APP_COOKIE, APP_URL);
  const only = process.env.ONLY;
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const results = [];

  for (const screen of SCREENS) {
    if (only && screen.key !== only) continue;
    for (const theme of THEMES) {
      const refFile = path.join(REF_DIR, `${screen.ref}-${theme.suffix}.png`);
      let status = "OK";
      let pct = null;
      const page = await browser.newPage();
      if (screen.auth && cookies.length) await page.setCookie(...cookies);
      try {
        if (!fs.existsSync(refFile)) throw new Error(`ref ausente: ${refFile}`);
        const ref = readRef(refFile);
        const app = await shootApp(page, APP_URL + screen.app, theme.name, ref.width, ref.height);
        const [a, b, w, h] = cropToCommon(ref, app);
        const diff = new PNG({ width: w, height: h });
        const mismatch = pixelmatch(a.data, b.data, diff.data, w, h, {
          threshold: 0.1,
          includeAA: false,
        });
        pct = (mismatch / (w * h)) * 100;
        const base = `${screen.key}-${theme.name}`;
        fs.writeFileSync(path.join(OUT_DIR, `${base}.ref.png`), PNG.sync.write(a));
        fs.writeFileSync(path.join(OUT_DIR, `${base}.app.png`), PNG.sync.write(b));
        fs.writeFileSync(path.join(OUT_DIR, `${base}.diff.png`), PNG.sync.write(diff));
        status = pct <= THRESHOLD ? "PASS" : "FAIL";
      } catch (e) {
        status = "ERROR";
        console.error(`  ! ${screen.key}/${theme.name}: ${e.message}`);
      }
      await page.close();
      console.log(
        `${screen.key.padEnd(10)} ${theme.name.padEnd(5)} ${
          pct === null ? status : pct.toFixed(2) + "%  " + status
        }`
      );
      results.push({ key: screen.key, theme: theme.name, pct, status });
    }
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(results, null, 2));
  const passed = results.filter((r) => r.status === "PASS").length;
  console.log(`\n${passed}/${results.length} PASS (threshold ${THRESHOLD}%).`);
  if (passed < results.length) process.exitCode = 1;
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
