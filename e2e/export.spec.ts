import { readFileSync } from 'node:fs';
import { acts, addActivity, addCoaches, createMonth, expect, panel, start, test } from './helpers';

function pngSize(buf: Buffer) {
  expect(buf.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test.beforeEach(async ({ page }) => {
  await start(page);
  await createMonth(page);
  await addActivity(page, '2026-10-13', '7–9 år klass');
  await addCoaches(page, ['Coach 6', 'Coach 4']);
  await addActivity(page, '2026-10-10', 'Kalas');
  await panel(page).getByLabel('Kontakt (e-post)').fill('hemlig@example.com');
  await panel(page).getByLabel('Ålder').fill('8');
  await panel(page).getByLabel('Kalasanteckning').fill('Nötallergi');
  await addCoaches(page, ['Coach 3']);
});

test('visningsläget döljer alla redigeringskontroller (F11)', async ({ page }) => {
  await page.getByRole('button', { name: 'Visa', exact: true }).click();
  const sheet = page.getByTestId('sheet');
  await expect(sheet.getByRole('heading', { name: 'Katana Parkour – OKTOBER 2026' })).toBeVisible();
  await expect(page.locator('.coach-list')).toHaveCount(0);
  await expect(page.getByTestId('side-panel')).toHaveCount(0);
  await expect(sheet.locator('button')).toHaveCount(0);
  await expect(sheet.locator('.warn, .warn-badge, .selected')).toHaveCount(0);
  await expect(sheet.locator('.cal-weekday')).toHaveText(['sön', 'mån', 'tis', 'ons', 'tors', 'fre', 'lör']);
  await expect(sheet.locator('[data-date="2026-10-10"] .act-title')).toHaveText('Kalas 8 år');
  // Kontaktuppgifter och kalasanteckning syns aldrig i bilden
  await expect(sheet).not.toContainText('hemlig@example.com');
  await expect(sheet).not.toContainText('E-post');
  await expect(sheet).not.toContainText('Nötallergi');
  expect(await sheet.innerHTML()).not.toContain('hemlig@example.com');
});

test('bildens språk väljs separat från appens språk', async ({ page }) => {
  await page.getByRole('button', { name: 'Visa', exact: true }).click();
  await page.getByRole('button', { name: 'English' }).click();
  const sheet = page.getByTestId('sheet');
  await expect(sheet.getByRole('heading')).toHaveText('Katana Parkour – OCTOBER 2026');
  await expect(sheet.locator('.cal-weekday').first()).toHaveText('Sun');
  await expect(sheet.locator('[data-date="2026-10-13"] .act-title')).toHaveText('7–9 YO Class');
  await expect(sheet.locator('[data-date="2026-10-10"] .act-title')).toHaveText('Party 8 YO');
  // Appen är fortfarande på svenska
  await expect(page.getByRole('button', { name: 'Redigera' })).toBeVisible();
  await page.getByRole('button', { name: 'Redigera' }).click();
  await expect(acts(page, '2026-10-13').locator('.act-title')).toHaveText('7–9 år klass');
});

test('exporterar PNG 2400 px bred med rätt filnamn och markerar månaden publicerad (F12)', async ({ page }) => {
  await expect(page.locator('.month-header .badge').first()).toHaveText('Utkast');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportera PNG' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('schema-2026-10.png');
  const buf = readFileSync((await download.path())!);
  const { width, height } = pngSize(buf);
  expect(width).toBe(2400);
  expect(height).toBeGreaterThan(1200);
  expect(height).toBeLessThan(4000);
  await expect(page.locator('.month-header .badge-published')).toContainText('Publicerad');
  await expect(page.locator('.month-header')).not.toContainText('Ändrad efter senaste export');

  // En ändring efter exporten syns som påminnelse
  await acts(page, '2026-10-13').click();
  await panel(page).getByLabel('Starttid').fill('17:30');
  await panel(page).getByLabel('Starttid').press('Enter');
  await expect(page.locator('.month-header')).toContainText('Ändrad efter senaste export');
  // Ändra tillbaka → ingen påminnelse
  await panel(page).getByLabel('Starttid').fill('17:00');
  await panel(page).getByLabel('Starttid').press('Enter');
  await expect(page.locator('.month-header')).not.toContainText('Ändrad efter senaste export');
  // Kalasets e-post påverkar inte bilden
  await acts(page, '2026-10-10').click();
  await panel(page).getByLabel('Kontakt (e-post)').fill('annan@example.com');
  await expect(page.locator('.month-header')).not.toContainText('Ändrad efter senaste export');
});

test('exportbilden innehåller samma sak som visningsläget och växer med fulla dagar', async ({ page }) => {
  for (let i = 0; i < 8; i++) await addActivity(page, '2026-10-14', 'Red band');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportera PNG' }).click();
  const { width, height } = pngSize(readFileSync((await (await downloadPromise).path())!));
  expect(width).toBe(2400);
  // Åtta pass i en dag gör veckoraden högre än standard
  expect(height).toBeGreaterThan(1700);
  // Exportytan tas bort efteråt
  await expect(page.locator('#export-sheet')).toHaveCount(0);
});
