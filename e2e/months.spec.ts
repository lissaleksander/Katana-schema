import { acts, addActivity, addCoaches, chipNames, createMonth, expect, panel, start, test, toast } from './helpers';

test.beforeEach(async ({ page }) => {
  await start(page);
});

test('november skapas från oktober med sammanfattning (F3, mål för version 1)', async ({ page }) => {
  await createMonth(page);
  await addActivity(page, '2026-10-06', '7–9 år klass'); // första tisdagen
  await addCoaches(page, ['Coach 6', 'Coach 4']);
  await addActivity(page, '2026-10-25', 'Familjeparkour'); // fjärde söndagen
  await addCoaches(page, ['Coach 2']);
  await addActivity(page, '2026-10-29', '10 år klass'); // femte torsdagen
  await addActivity(page, '2026-10-10', 'Kalas');
  await addActivity(page, '2026-10-26', 'Läger 7–9 år / 10–12 år');

  await createMonth(page, { month: 'november', copyFrom: 'Oktober 2026' });
  const summary = page.getByTestId('new-month-summary');
  await expect(summary).toContainText(
    '3 aktiviteter kopierade, 1 kalas hoppades över, 1 läger hoppades över, 1 pass på en femte veckodag som saknas hoppades över.',
  );
  await summary.getByRole('button', { name: 'OK' }).click();

  await expect(page.getByRole('tab', { name: 'Nov 2026' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'November 2026' })).toBeVisible();
  expect(await chipNames(acts(page, '2026-11-03'))).toEqual(['Coach 6', 'Coach 4']);
  await expect(acts(page, '2026-11-22').locator('.act-title')).toHaveText('Familjeparkour');
  await expect(acts(page, '2026-11-29').locator('.act-title')).toHaveText('Familjeparkour');
  await expect(page.locator('.calendar-edit .act')).toHaveCount(3);

  // Oktober är orörd
  await page.getByRole('tab', { name: 'Okt 2026' }).click();
  await expect(page.locator('.calendar-edit .act')).toHaveCount(5);
});

test('kopiera utan coacher', async ({ page }) => {
  await createMonth(page);
  await addActivity(page, '2026-10-06', '7–9 år klass');
  await addCoaches(page, ['Coach 6']);
  await createMonth(page, { month: 'november', copyFrom: 'Oktober 2026', withoutCoaches: true });
  await page.getByTestId('new-month-summary').getByRole('button', { name: 'OK' }).click();
  await expect(acts(page, '2026-11-03')).toHaveCount(1);
  expect(await chipNames(acts(page, '2026-11-03'))).toEqual([]);
});

test('tom månad och dialogens standardval', async ({ page }) => {
  await createMonth(page);
  await page.getByRole('button', { name: '+ Ny månad' }).click();
  const dlg = page.getByTestId('new-month-dialog');
  // Föreslår månaden efter den senaste och att kopiera
  await expect(dlg.getByLabel('Månad', { exact: true })).toHaveValue('11');
  await expect(dlg.getByLabel('Kopiera från')).toBeChecked();
  // En månad som redan finns kan inte skapas
  await dlg.getByLabel('Månad', { exact: true }).selectOption({ label: 'oktober' });
  await expect(dlg.getByText('Oktober 2026 finns redan.')).toBeVisible();
  await expect(dlg.getByRole('button', { name: 'Skapa' })).toBeDisabled();
  await dlg.getByLabel('Månad', { exact: true }).selectOption({ label: 'december' });
  await dlg.getByLabel('Tom månad').check();
  await dlg.getByRole('button', { name: 'Skapa' }).click();
  await expect(page.getByRole('tab')).toHaveText(['Okt 2026', 'Dec 2026']);
  await expect(page.locator('.calendar-edit .day[data-date]')).toHaveCount(31);
});

test('flikar: byt fritt mellan månader (F2)', async ({ page }) => {
  await createMonth(page);
  await addActivity(page, '2026-10-13', '7–9 år klass');
  await createMonth(page, { month: 'november' });
  await addActivity(page, '2026-11-10', 'Red band');
  await page.getByRole('tab', { name: 'Okt 2026' }).click();
  await expect(page.locator('.calendar-edit .act-title')).toHaveText(['7–9 år klass']);
  await expect(panel(page).getByText('Klicka på ett pass')).toBeVisible();
  await page.getByRole('tab', { name: 'Nov 2026' }).click();
  await expect(page.locator('.calendar-edit .act-title')).toHaveText(['Red band']);
});

test('ta bort månad med bekräftelse och ångra', async ({ page }) => {
  await createMonth(page);
  await addActivity(page, '2026-10-13', '7–9 år klass');
  await page.getByRole('button', { name: 'Ta bort månad' }).click();
  const confirm = page.getByTestId('confirm-dialog');
  await confirm.getByRole('button', { name: 'Avbryt' }).click();
  await expect(page.getByRole('tab', { name: 'Okt 2026' })).toBeVisible();
  await page.getByRole('button', { name: 'Ta bort månad' }).click();
  await confirm.getByRole('button', { name: 'Ta bort månad' }).click();
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Välkommen!' })).toBeVisible();
  await toast(page).getByRole('button', { name: 'Ångra' }).click();
  await expect(page.getByRole('tab', { name: 'Okt 2026' })).toBeVisible();
  await expect(acts(page, '2026-10-13')).toHaveCount(1);
});
