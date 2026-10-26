import { acts, addActivity, addCoaches, chipNames, createMonth, expect, panel, start, test, toast } from './helpers';

test.beforeEach(async ({ page }) => {
  await start(page);
  await createMonth(page);
});

test('ny coach med färg, automatisk textfärg och byt namn (F9)', async ({ page }) => {
  await page.getByRole('button', { name: '+ Ny coach' }).click();
  const dlg = page.getByTestId('coach-dialog');
  // Tomt namn går inte att spara
  await dlg.getByRole('button', { name: 'Spara' }).click();
  await expect(dlg.getByText('Namnet får inte vara tomt')).toBeVisible();
  await dlg.getByLabel('Namn').fill('Elton');
  // Första lediga föreslagna färg är vald; välj mörkblå i stället via färgkod
  await dlg.getByLabel('Färgkod').fill('#1e3a8a');
  await expect(dlg.getByText('Automatisk (Vit)')).toBeVisible();
  await dlg.getByRole('button', { name: 'Spara' }).click();
  const chip = page.locator('.coach-list .chip', { hasText: /^Elton$/ });
  await expect(chip).toHaveCSS('background-color', 'rgb(30, 58, 138)');
  await expect(chip).toHaveCSS('color', 'rgb(255, 255, 255)');

  await page.getByRole('button', { name: 'Redigera Elton' }).click();
  await dlg.getByLabel('Namn').fill('Elton J');
  await dlg.getByLabel('Svart').check();
  await dlg.getByRole('button', { name: 'Spara' }).click();
  await expect(page.locator('.coach-list .chip', { hasText: /^Elton J$/ })).toHaveCSS('color', 'rgb(0, 0, 0)');
  // Listan är sorterad på namn
  await expect(page.locator('.coach-list > ul .chip-name').last()).toHaveText('Elton J');
});

test('coach som används inaktiveras och finns kvar i schemat; oanvänd kan tas bort', async ({ page }) => {
  await addActivity(page, '2026-10-13', '7–9 år klass');
  await addCoaches(page, ['Coach 7']);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Redigera Coach 7' }).click({ force: true });
  const dlg = page.getByTestId('coach-dialog');
  await expect(dlg.getByRole('button', { name: 'Ta bort' })).toHaveCount(0);
  await dlg.getByLabel('Aktiv').uncheck();
  await dlg.getByRole('button', { name: 'Spara' }).click();
  await expect(page.locator('.coach-list > ul').first()).not.toContainText('Coach 7');
  expect(await chipNames(acts(page, '2026-10-13'))).toEqual(['Coach 7']);
  // Inte valbar på nya pass
  await acts(page, '2026-10-13').click();
  await panel(page).getByRole('button', { name: '+ Lägg till coach' }).click();
  await expect(panel(page).locator('.coach-picker')).not.toContainText('Coach 7');
  // Syns under "Visa inaktiva" och kan aktiveras igen
  await page.getByRole('button', { name: 'Visa inaktiva (1)' }).click();
  await page.locator('.inactive-list').getByRole('button', { name: 'Redigera Coach 7' }).click();
  await dlg.getByLabel('Aktiv').check();
  await dlg.getByRole('button', { name: 'Spara' }).click();
  await expect(page.locator('.coach-list > ul').first()).toContainText('Coach 7');

  // Oanvänd coach tas bort helt, och det går att ångra
  await page.getByRole('button', { name: 'Redigera Coach 15' }).click({ force: true });
  await dlg.getByRole('button', { name: 'Ta bort' }).click();
  await expect(page.locator('.coach-list')).not.toContainText('Coach 15');
  await toast(page).getByRole('button', { name: 'Ångra' }).click();
  await expect(page.locator('.coach-list')).toContainText('Coach 15');
});

test('aktivitetstyper: byt namn, ny typ, inaktivera (F10)', async ({ page }) => {
  await page.getByRole('button', { name: 'Aktivitetstyper' }).click();
  const dlg = page.getByTestId('types-dialog');
  const row = dlg.locator('[data-type-id="t5"]');
  await row.getByLabel('Namn (svenska)').fill('Lunchpass');
  await row.getByLabel('Namn (engelska)').fill('Lunch session');
  await row.getByLabel('Starttid').fill('11:30');
  await row.getByLabel('Sluttid').fill('12:30');
  await row.getByLabel('Sluttid').press('Enter');
  // Tomt namn accepteras inte
  const red = dlg.locator('[data-type-id="t20"]');
  await red.getByLabel('Namn (svenska)').fill('');
  await red.getByLabel('Namn (svenska)').blur();
  await expect(red.getByLabel('Namn (svenska)')).toHaveValue('Red band');
  // Ny typ
  await dlg.getByRole('button', { name: '+ Ny aktivitetstyp' }).click();
  const newRow = dlg.locator('.types-row').last();
  await expect(newRow.getByLabel('Namn (svenska)')).toBeFocused();
  await newRow.getByLabel('Namn (svenska)').fill('Halloweenpass');
  await newRow.getByLabel('Kategori').selectOption({ label: 'Övrigt' });
  // Inaktivera Babyparkour
  await dlg.locator('[data-type-id="t4"]').getByLabel('Aktiv').uncheck();
  await dlg.getByRole('button', { name: 'Klar' }).click();

  await addActivity(page, '2026-10-13', 'Lunchpass');
  await expect(acts(page, '2026-10-13').locator('.act-time')).toHaveText('11:30–12:30');
  await addActivity(page, '2026-10-14', 'Halloweenpass');
  await page.locator('.calendar-edit .day[data-date="2026-10-15"]').hover();
  await page.locator('.calendar-edit .day[data-date="2026-10-15"] .day-add').click();
  const add = page.getByTestId('add-activity-dialog');
  await add.getByRole('searchbox').fill('baby');
  await expect(add.getByText('Ingen aktivitetstyp matchar.')).toBeVisible();
  await add.getByRole('button', { name: 'Stäng' }).click();

  // Engelskt namn i exporten
  await page.getByRole('button', { name: 'Visa', exact: true }).click();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByTestId('sheet').locator('[data-date="2026-10-13"] .act-title')).toHaveText('Lunch session');
  // Saknas engelskt namn används det svenska
  await expect(page.getByTestId('sheet').locator('[data-date="2026-10-14"] .act-title')).toHaveText('Halloweenpass');
});

test('inställningar: namn i rubriken och logga', async ({ page }) => {
  await page.getByRole('button', { name: 'Inställningar' }).click();
  const dlg = page.getByTestId('settings-dialog');
  await dlg.getByLabel('Namn i rubriken').fill('Katana Parkour Göteborg');
  // 1x1 px PNG
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );
  await dlg.locator('input[type=file]').setInputFiles({ name: 'logga.png', mimeType: 'image/png', buffer: png });
  await expect(dlg.getByRole('img', { name: 'Logga' })).toBeVisible();
  await dlg.getByRole('button', { name: 'Klar' }).click();
  await page.getByRole('button', { name: 'Visa', exact: true }).click();
  const sheet = page.getByTestId('sheet');
  await expect(sheet.getByRole('heading')).toHaveText('Katana Parkour Göteborg – OKTOBER 2026');
  await expect(sheet.locator('img.sheet-logo')).toHaveAttribute('src', /^data:image\/png/);
  // Ta bort loggan
  await page.getByRole('button', { name: 'Redigera' }).click();
  await page.getByRole('button', { name: 'Inställningar' }).click();
  await dlg.getByRole('button', { name: 'Ta bort logga' }).click();
  await dlg.getByRole('button', { name: 'Klar' }).click();
  await page.getByRole('button', { name: 'Visa', exact: true }).click();
  await expect(sheet.locator('img')).toHaveCount(0);
});
