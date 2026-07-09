/**
 * Harness e2e partagé (Playwright, sans @playwright/test). Volontairement léger :
 * chaque suite importe `launch` / `session` / `harness` / `openDemo` et déroule
 * ses assertions. Résout Chromium de façon résiliente (survit aux bumps de
 * version), garde le journal des erreurs console, et neutralise la navigation
 * vers les deep-links natifs (tel:/sms:/wa.me/maps) sans casser le onClick.
 */
import { existsSync, readdirSync } from 'node:fs';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';

const { chromium } = pw;

export const URL = process.env.E2E_URL ?? 'http://localhost:4173/';

function resolveExecutable() {
  if (process.env.PW_EXECUTABLE && existsSync(process.env.PW_EXECUTABLE))
    return process.env.PW_EXECUTABLE;
  const base = '/opt/pw-browsers';
  try {
    const dir = readdirSync(base)
      .filter((d) => /^chromium-\d+$/.test(d))
      .sort()
      .pop();
    if (dir) {
      const p = `${base}/${dir}/chrome-linux/chrome`;
      if (existsSync(p)) return p;
    }
  } catch {
    /* fallback below */
  }
  return undefined; // laisse Playwright résoudre son navigateur embarqué
}

export async function launch() {
  const executablePath = resolveExecutable();
  return chromium.launch(executablePath ? { executablePath } : {});
}

const DEEP_LINK_GUARD = () => {
  document.addEventListener(
    'click',
    (e) => {
      const t = e.target;
      const a = t && t.closest ? t.closest('a') : null;
      const href = a && a.getAttribute('href');
      if (
        href &&
        /^(tel:|sms:|mailto:|https:\/\/wa\.me|https:\/\/www\.google\.com\/maps)/.test(href)
      )
        e.preventDefault();
    },
    true,
  );
};

export async function session(browser, opts = {}) {
  const { width = 1280, height = 1800, guardDeepLinks = false, timezoneId } = opts;
  const ctx = await browser.newContext({
    viewport: { width, height },
    ...(timezoneId ? { timezoneId } : {}),
  });
  const page = await ctx.newPage();
  if (guardDeepLinks) await page.addInitScript(DEEP_LINK_GUARD);
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
  return { ctx, page, consoleErrors };
}

export function harness() {
  const results = [];
  const assert = async (name, fn) => {
    try {
      await fn();
      results.push(['PASS', name]);
      console.log('  OK ', name);
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      results.push(['FAIL', name, msg]);
      console.log('  XX ', name, '--', msg);
    }
  };
  const summary = (consoleErrors = []) => {
    const passed = results.filter((r) => r[0] === 'PASS').length;
    console.log(`\n=== ${passed}/${results.length} PASS ===`);
    if (consoleErrors.length) {
      console.log('CONSOLE:', consoleErrors.length);
      consoleErrors.slice(0, 6).forEach((e) => console.log('  -', e));
    }
    return results.filter((r) => r[0] === 'FAIL').length;
  };
  return { assert, summary, results };
}

/** Ouvre la démo seedée et attend l'écran conducteur (« Bonjour Mickaël »). */
export async function openDemo(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  // Consentement cookies pré-accepté par défaut : le bandeau « première connexion »
  // ne doit pas gêner les suites existantes (la suite dédiée le teste à part).
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('phenix-demo:cookie-consent:v1', new Date().toISOString());
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page
    .getByRole('button', { name: /Découvrir la démo/ })
    .click()
    .catch(() => {});
  await page
    .getByRole('heading', { name: /Bonjour Mickaël/ })
    .waitFor({ state: 'visible', timeout: 15000 });
}

/**
 * Ouvre l'Espace client sur l'un de ses onglets (Aujourd'hui / Vos demandes /
 * Vos choix / Documents / Dans les coulisses). L'onglet « Aujourd'hui » du client
 * coexiste avec le sélecteur de vue « Aujourd'hui » de l'en-tête : on cible donc
 * le DERNIER (celui de l'espace client, rendu après l'en-tête).
 */
export async function openClientTab(page, sub = 'Aujourd’hui') {
  await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
  const isAujourdhui = /Aujourd/.test(sub);
  const tab = page.getByRole('tab', { name: isAujourdhui ? /Aujourd/ : sub });
  await (isAujourdhui ? tab.last() : tab.first()).click();
  await page.waitForTimeout(200);
}

/** Carte de contact (bloc .rounded-xl qui porte le nom ET les actions). */
export const contactCard = (page, name) =>
  page
    .locator('.rounded-xl.border-border')
    .filter({ hasText: name })
    .filter({ has: page.getByRole('button', { name: 'WhatsApp' }) })
    .first();
