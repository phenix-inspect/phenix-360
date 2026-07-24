/**
 * STOCKAGE SATURÉ — la perte de données n'est JAMAIS silencieuse (bêta-readiness).
 * ===========================================================================
 * En usage réel (beaucoup de photos), le quota localStorage peut se remplir.
 * La session reste fonctionnelle (vérité en mémoire), mais le travail pourrait
 * ne pas survivre à un rechargement. Sans signal VISIBLE, l'utilisateur perdrait
 * son travail sans comprendre — le pire appel au support (« mes photos ont
 * disparu »). On vérifie qu'une écriture qui échoue déclenche un avertissement
 * clair et persistant dans l'interface.
 *
 * Méthode : on force `Storage.prototype.setItem` à lever (QuotaExceededError),
 * puis on déclenche une écriture (changer de chantier) et on attend le bandeau.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 1400 });
const { assert, summary } = harness();

try {
  await openDemo(page);

  await assert('Aucun avertissement de stockage au départ', async () => {
    if (
      (await page
        .getByRole('alert')
        .filter({ hasText: /stockage saturé/i })
        .count()) > 0
    )
      throw new Error('le bandeau de saturation est affiché à tort');
  });

  await assert('Se placer sur un chantier (sélecteur de chantier disponible)', async () => {
    await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
    await page.getByLabel('Changer de chantier').waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Quand une écriture échoue (quota), un avertissement apparaît', async () => {
    // Sature le stockage : toute écriture lèvera désormais.
    await page.evaluate(() => {
      Storage.prototype.setItem = function () {
        throw new DOMException('quota', 'QuotaExceededError');
      };
    });
    // Déclenche une écriture (changement de chantier actif → persistance).
    await page.getByLabel('Changer de chantier').selectOption({ label: 'Maison Écully' });
    const banner = page.getByRole('alert').filter({ hasText: /stockage saturé/i });
    await banner.waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('L’avertissement explique que rien n’est perdu pour la session', async () => {
    await page
      .getByText(/reste actif pour cette session/i)
      .first()
      .waitFor({ state: 'visible', timeout: 3000 });
  });

  await assert('La session reste utilisable (le chantier a bien changé)', async () => {
    // Malgré le quota, la vérité mémoire garde l'app fonctionnelle.
    await page
      .getByRole('heading', { name: /Maison Écully|M\. Dubois|Écully/i })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  // NB : on n'exige pas « zéro erreur console » ici — le warn de persistance
  // (console.warn) est justement le comportement attendu quand le quota déborde.
} catch (e) {
  await assert('FATAL', async () => {
    throw e;
  });
} finally {
  const failed = summary([]);
  await browser.close();
  process.exit(failed ? 1 : 0);
}
