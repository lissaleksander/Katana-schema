import { acts, addActivity, addCoaches, chipNames, createMonth, expect, start, test, waitForAutosave } from './helpers';

test('allt sparas automatiskt i webbläsaren och finns kvar efter omladdning', async ({ page }) => {
  await start(page);
  await createMonth(page);
  await addActivity(page, '2026-10-13', '7–9 år klass');
  await addCoaches(page, ['Coach 6']);
  await page.getByRole('button', { name: 'Visa', exact: true }).click();
  await waitForAutosave(page);
  await page.reload();
  // Läge och månad kommer ihåg
  await expect(page.getByRole('button', { name: 'Visa', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Redigera' }).click();
  expect(await chipNames(acts(page, '2026-10-13'))).toEqual(['Coach 6']);
  // Ångra-historiken gäller bara sessionen
  await page.keyboard.press('Control+z');
  await expect(acts(page, '2026-10-13')).toHaveCount(1);
});

test('engelska som gränssnittsspråk, och valet kommer ihåg', async ({ page }) => {
  await start(page);
  await createMonth(page);
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Oct 2026' })).toBeVisible();
  await expect(page.locator('.calendar-edit .cal-weekday').first()).toHaveText('Sun');
  await expect(page.getByRole('heading', { name: 'Coaches' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  // Aktivitetsnamn i redigeringsläget följer gränssnittets språk
  await page.locator('.calendar-edit .day[data-date="2026-10-13"]').hover();
  await page.locator('.calendar-edit .day[data-date="2026-10-13"] .day-add').click();
  await page.getByTestId('add-activity-dialog').getByRole('searchbox').fill('7–9 YO Class');
  await page.keyboard.press('Enter');
  await expect(acts(page, '2026-10-13').locator('.act-title')).toHaveText('7–9 YO Class');
  await waitForAutosave(page);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
  // Bilden är fortfarande på svenska tills den ändras
  await page.getByRole('button', { name: 'View' }).click();
  await expect(page.getByTestId('sheet').getByRole('heading')).toHaveText('Katana Parkour – OKTOBER 2026');
});

test('varnar när appen är öppen i två flikar', async ({ page, context }) => {
  await start(page);
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByText('Appen är öppen i en annan flik')).toBeVisible();
  await expect(page.getByText('Appen är öppen i en annan flik')).toBeVisible();
});

test('fungerar offline efter första besöket (PWA)', async ({ page, context }) => {
  await start(page);
  await createMonth(page);
  await addActivity(page, '2026-10-13', '7–9 år klass');
  // Service workern är aktiv (alla filer förhämtade); nästa sidladdning går genom den
  expect(await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state)).toBe('activated');
  await waitForAutosave(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Okt 2026' })).toBeVisible();
  await expect(acts(page, '2026-10-13')).toHaveCount(1);
  await context.setOffline(false);
});

test('manifest och ikoner för installation finns', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.name).toBe('Schema – Katana Parkour');
  expect(manifest.display).toBe('standalone');
  for (const icon of manifest.icons) {
    const res = await request.get('/' + icon.src);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
  }
});

test('tangentbord: pass går att välja och skapa utan mus', async ({ page }) => {
  await start(page);
  await createMonth(page);
  await addActivity(page, '2026-10-13', '7–9 år klass');
  await page.keyboard.press('Escape');
  await acts(page, '2026-10-13').focus();
  await page.keyboard.press('Enter');
  await expect(acts(page, '2026-10-13')).toHaveClass(/selected/);
  await page.locator('.calendar-edit .day[data-date="2026-10-14"] .day-add').focus();
  await page.keyboard.press('Enter');
  await page.getByTestId('add-activity-dialog').getByRole('searchbox').fill('red band');
  await page.keyboard.press('Enter');
  await expect(acts(page, '2026-10-14').locator('.act-title')).toHaveText('Red band');
});

test('skadad data i webbläsaren: appen startar ändå, säkerhetskopierar och visar vad man ska göra', async ({ page, consoleErrors }) => {
  await start(page);
  await createMonth(page);
  await waitForAutosave(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('katana-schema');
        req.onsuccess = () => {
          const tx = req.result.transaction('kv', 'readwrite');
          tx.objectStore('kv').put({ version: 1, coaches: 'trasigt' }, 'data');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  const banner = page.getByTestId('storage-problem');
  await expect(banner).toContainText('Sparad data i webbläsaren kunde inte läsas och har inte skrivits över');
  await expect(page.getByRole('heading', { name: 'Välkommen!' })).toBeVisible();
  // Inget skrivs över medan man arbetar
  await createMonth(page);
  await waitForAutosave(page);
  const stored = await page.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        const req = indexedDB.open('katana-schema');
        req.onsuccess = () => {
          const r = req.result.transaction('kv').objectStore('kv').get('data');
          r.onsuccess = () => resolve(r.result);
        };
      }),
  );
  expect(stored).toEqual({ version: 1, coaches: 'trasigt' });
  // "Börja om" slår på autosparningen igen
  await banner.getByRole('button', { name: 'Börja om' }).click();
  await expect(banner).toHaveCount(0);
  await waitForAutosave(page);
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Okt 2026' })).toBeVisible();
  const keys = await page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const req = indexedDB.open('katana-schema');
        req.onsuccess = () => {
          const r = req.result.transaction('kv').objectStore('kv').getAllKeys();
          r.onsuccess = () => resolve(r.result.map(String));
        };
      }),
  );
  expect(keys.some((k) => k.startsWith('corrupt-'))).toBe(true);
  // Felet loggas avsiktligt i konsolen
  expect(consoleErrors.join()).toContain('Sparad data kunde inte läsas');
  consoleErrors.length = 0;
});

test('startsidan erbjuder att öppna en sparfil', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showOpenFilePicker', { value: undefined, configurable: true });
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
  });
  await start(page);
  await expect(page.getByText('Har du en sparfil?')).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Öppna sparfil' }).click();
  await chooser;
});
