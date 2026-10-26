import { acts, addActivity, addCoaches, chipNames, createMonth, day, expect, panel, start, test, toast } from './helpers';

test.beforeEach(async ({ page }) => {
  await start(page);
  await createMonth(page);
});

test('första start: oktober skapas, 15 coacher finns, veckan börjar på söndag', async ({ page }) => {
  await expect(page.getByRole('tab', { name: 'Okt 2026' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Oktober 2026' })).toBeVisible();
  await expect(page.locator('.coach-list > ul > li')).toHaveCount(15);
  await expect(page.locator('.calendar-edit .cal-weekday')).toHaveText(['sön', 'mån', 'tis', 'ons', 'tors', 'fre', 'lör']);
  // 1 oktober 2026 är en torsdag → fyra tomma rutor först
  await expect(page.locator('.calendar-edit .cal-week').first().locator('.day-out')).toHaveCount(4);
  await expect(page.locator('.calendar-edit .day[data-date]')).toHaveCount(31);
});

test('lägg till pass: typ → standardtid → coacher, i rätt ordning (F5, F7)', async ({ page }) => {
  await addActivity(page, '2026-10-13', '7–9 år klass');
  const p = panel(page);
  await expect(p.getByLabel('Typ')).toHaveValue('t6');
  await expect(p.getByLabel('Starttid')).toHaveValue('17:00');
  await expect(p.getByLabel('Sluttid')).toHaveValue('18:00');
  await addCoaches(page, ['Coach 6', 'Coach 4', 'Coach 1']);
  const a = acts(page, '2026-10-13');
  await expect(a).toHaveCount(1);
  await expect(a.locator('.act-time')).toHaveText('17:00–18:00');
  await expect(a.locator('.act-title')).toHaveText('7–9 år klass');
  expect(await chipNames(a)).toEqual(['Coach 6', 'Coach 4', 'Coach 1']);

  // Ändra ordning och ta bort en coach
  await p.getByRole('button', { name: 'Flytta Coach 1 uppåt' }).click();
  expect(await chipNames(a)).toEqual(['Coach 6', 'Coach 1', 'Coach 4']);
  await p.getByRole('button', { name: 'Ta bort Coach 6 från passet' }).click();
  expect(await chipNames(a)).toEqual(['Coach 1', 'Coach 4']);
  // Coachen kan inte läggas till två gånger
  await p.getByRole('button', { name: '+ Lägg till coach' }).click();
  await expect(p.locator('.coach-picker .chip', { hasText: /^Coach 1$/ })).toHaveCount(0);
});

test('ändra tid, titel och anteckning i panelen (F6)', async ({ page }) => {
  await addActivity(page, '2026-10-14', '10–12 år tjejklass');
  const p = panel(page);
  await p.getByLabel('Starttid').fill('1830');
  await p.getByLabel('Sluttid').fill('19.45');
  await p.getByLabel('Sluttid').press('Enter');
  await p.getByLabel('Egen titel').fill('Halloweenpass');
  await p.getByLabel('Anteckning', { exact: true }).fill('Utklädnad');
  const a = acts(page, '2026-10-14');
  await expect(a.locator('.act-time')).toHaveText('18:30–19:45');
  await expect(a.locator('.act-title')).toHaveText('Halloweenpass');
  await expect(a.locator('.act-note')).toHaveText('Utklädnad');
  // Ogiltig tid återställs
  await p.getByLabel('Starttid').fill('25:99');
  await p.getByLabel('Starttid').blur();
  await expect(p.getByLabel('Starttid')).toHaveValue('18:30');
  // Standardtiden kan återställas
  await p.getByRole('button', { name: 'Använd standardtid 18:15–19:15' }).click();
  await expect(a.locator('.act-time')).toHaveText('18:15–19:15');
});

test('dagen sorteras: kalas överst, sedan starttid, öppet gym sist', async ({ page }) => {
  await addActivity(page, '2026-10-17', 'Öppet gym helg');
  await addActivity(page, '2026-10-17', '7–9 år klass');
  await panel(page).getByLabel('Starttid').fill('11:00');
  await panel(page).getByLabel('Sluttid').fill('12:00');
  await panel(page).getByLabel('Sluttid').blur();
  await addActivity(page, '2026-10-17', 'Kalas');
  await panel(page).getByLabel('Ålder').fill('8');
  await addActivity(page, '2026-10-17', 'Familjeklass helg');
  await expect(acts(page, '2026-10-17').locator('.act-title')).toHaveText([
    'Kalas 8 år',
    '7–9 år klass',
    'Familjeklass helg',
    'Öppet gym helg',
  ]);
});

test('ta bort pass och ångra via toast, tangentbord och Cmd/Ctrl+Z (F6, F14)', async ({ page }) => {
  await addActivity(page, '2026-10-13', '7–9 år klass');
  await addCoaches(page, ['Coach 2']);
  await panel(page).getByRole('button', { name: 'Ta bort', exact: true }).click();
  await expect(acts(page, '2026-10-13')).toHaveCount(0);
  await toast(page).getByRole('button', { name: 'Ångra' }).click();
  await expect(acts(page, '2026-10-13')).toHaveCount(1);

  // Delete-tangenten på valt pass
  await acts(page, '2026-10-13').click();
  await page.keyboard.press('Delete');
  await expect(acts(page, '2026-10-13')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(acts(page, '2026-10-13')).toHaveCount(1);
  await page.keyboard.press('Control+Shift+z');
  await expect(acts(page, '2026-10-13')).toHaveCount(0);
  await page.keyboard.press('Meta+z');
  await expect(acts(page, '2026-10-13')).toHaveCount(1);
  expect(await chipNames(acts(page, '2026-10-13'))).toEqual(['Coach 2']);
  // Ångra flera steg: coachen, sedan passet
  await page.keyboard.press('Meta+z');
  expect(await chipNames(acts(page, '2026-10-13'))).toEqual([]);
  await page.keyboard.press('Meta+z');
  await expect(acts(page, '2026-10-13')).toHaveCount(0);
  await page.keyboard.press('Meta+Shift+z');
  await expect(acts(page, '2026-10-13')).toHaveCount(1);
  // Ångra ända tillbaka till innan månaden skapades
  for (let i = 0; i < 3; i++) await page.keyboard.press('Control+z');
  await expect(page.getByRole('heading', { name: 'Välkommen!' })).toBeVisible();
  await page.keyboard.press('Control+y');
  await expect(page.getByRole('heading', { name: 'Oktober 2026' })).toBeVisible();
});

test('Cmd+Z i ett textfält ångrar texten, inte schemat', async ({ page }) => {
  await addActivity(page, '2026-10-13', '7–9 år klass');
  const note = panel(page).getByLabel('Anteckning', { exact: true });
  await note.fill('abc');
  await note.press('Control+z');
  await expect(acts(page, '2026-10-13')).toHaveCount(1);
});

test('snabbtilldelning: välj coach, klicka på flera pass, Esc avslutar (arbetsflöde 3, F17)', async ({ page }) => {
  await addActivity(page, '2026-10-13', '7–9 år klass');
  await addActivity(page, '2026-10-14', '7–9 år parkour');
  await addActivity(page, '2026-10-15', '10 år klass');
  await page.keyboard.press('Escape'); // avmarkera
  await expect(panel(page).getByText('Klicka på ett pass')).toBeVisible();

  await page.locator('.coach-list').getByRole('button', { name: 'Coach 2', exact: true }).click();
  await expect(page.locator('.assign-banner')).toContainText('0 pass i oktober 2026');
  await acts(page, '2026-10-13').click();
  await acts(page, '2026-10-14').click();
  await expect(page.locator('.assign-banner')).toContainText('2 pass i oktober 2026');
  // Övriga pass tonas ned, coachens lyses upp
  await expect(acts(page, '2026-10-15')).toHaveClass(/dim/);
  await expect(acts(page, '2026-10-13')).toHaveClass(/highlight/);
  // Klick igen tar bort coachen
  await acts(page, '2026-10-14').click();
  expect(await chipNames(acts(page, '2026-10-14'))).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.locator('.assign-banner')).toHaveCount(0);
  await acts(page, '2026-10-15').click();
  expect(await chipNames(acts(page, '2026-10-15'))).toEqual([]);
  // Antal pass i listan
  await expect(page.locator('.coach-list li', { hasText: 'Coach 2' }).first().locator('.coach-count')).toHaveText('1');
});

test('byta coach: klicka bort en lapp i panelen och klicka på en ny i listan (arbetsflöde 2)', async ({ page }) => {
  await addActivity(page, '2026-10-13', '7–9 år klass');
  await addCoaches(page, ['Coach 1']);
  await panel(page).getByRole('button', { name: 'Ta bort Coach 1 från passet' }).click();
  await expect(page.getByTestId('coach-hint')).toHaveText('Klicka på en coach för att lägga till den på valt pass.');
  await page.locator('.coach-list').getByRole('button', { name: 'Coach 5', exact: true }).click();
  expect(await chipNames(acts(page, '2026-10-13'))).toEqual(['Coach 5']);
  // Ingen snabbtilldelning startas: att klicka på ett annat pass ändrar det inte
  await expect(page.locator('.assign-banner')).toHaveCount(0);
  await addActivity(page, '2026-10-14', '7–9 år parkour');
  await acts(page, '2026-10-13').click();
  await acts(page, '2026-10-14').click();
  expect(await chipNames(acts(page, '2026-10-14'))).toEqual([]);
});

test('byta coach i snabbtilldelning lägger inte till den nya på senast klickade pass', async ({ page }) => {
  await addActivity(page, '2026-10-13', '7–9 år klass');
  await page.keyboard.press('Escape');
  await page.locator('.coach-list').getByRole('button', { name: 'Coach 1', exact: true }).click();
  await acts(page, '2026-10-13').click();
  await page.locator('.coach-list').getByRole('button', { name: 'Coach 2', exact: true }).click();
  expect(await chipNames(acts(page, '2026-10-13'))).toEqual(['Coach 1']);
  await expect(page.locator('.assign-banner')).toContainText('0 pass');
  // Samma coach igen avslutar
  await page.locator('.coach-list').getByRole('button', { name: 'Coach 2', exact: true }).click();
  await expect(page.locator('.assign-banner')).toHaveCount(0);
});

test('Backspace på en knapp i panelen tar inte bort passet', async ({ page }) => {
  await addActivity(page, '2026-10-13', '7–9 år klass');
  await panel(page).getByRole('button', { name: '+ Lägg till coach' }).click();
  await page.keyboard.press('Backspace');
  await page.getByRole('button', { name: 'Spara fil' }).focus();
  await page.keyboard.press('Delete');
  await expect(acts(page, '2026-10-13')).toHaveCount(1);
});

test('Cmd+Z fungerar direkt efter val i en rullgardinsmeny eller ett datumfält', async ({ page }) => {
  await addActivity(page, '2026-10-13', '7–9 år klass');
  await panel(page).getByLabel('Typ').focus();
  await panel(page).getByLabel('Typ').selectOption({ label: 'Red band' });
  await expect(panel(page).getByLabel('Typ')).toBeFocused();
  await page.keyboard.press('Meta+z');
  await expect(acts(page, '2026-10-13').locator('.act-title')).toHaveText('7–9 år klass');
  await panel(page).getByLabel('Datum').fill('2026-10-20');
  await expect(acts(page, '2026-10-20')).toHaveCount(1);
  await page.keyboard.press('Meta+z');
  await expect(acts(page, '2026-10-13')).toHaveCount(1);
});

test('toastens Ångra efter Cmd+Z ångrar inte något annat', async ({ page }) => {
  await addActivity(page, '2026-10-12', 'Familjeklass');
  await addActivity(page, '2026-10-13', '7–9 år klass');
  await page.keyboard.press('Delete');
  await expect(toast(page)).toContainText('Passet togs bort');
  await page.keyboard.press('Meta+z');
  await expect(toast(page)).toHaveCount(0);
  await expect(acts(page, '2026-10-12')).toHaveCount(1);
  await expect(acts(page, '2026-10-13')).toHaveCount(1);
});

test('kopiera pass till alla tisdagar resten av månaden (F8)', async ({ page }) => {
  await addActivity(page, '2026-10-13', '7–9 år klass');
  await addCoaches(page, ['Coach 3']);
  await panel(page).getByRole('button', { name: 'Kopiera till dagar…' }).click();
  const dlg = page.getByTestId('copy-days-dialog');
  await dlg.getByRole('button', { name: 'Alla tisdagar resten av månaden' }).click();
  await dlg.getByRole('button', { name: 'Kopiera till 2 dagar' }).click();
  await expect(toast(page)).toContainText('Passet kopierades till 2 dagar');
  for (const d of ['2026-10-20', '2026-10-27']) {
    await expect(acts(page, d)).toHaveCount(1);
    expect(await chipNames(acts(page, d))).toEqual(['Coach 3']);
  }
  await expect(acts(page, '2026-10-06')).toHaveCount(0);

  // Valda datum, och dagar som redan har passet hoppas över
  await acts(page, '2026-10-13').click();
  await panel(page).getByRole('button', { name: 'Kopiera till dagar…' }).click();
  await dlg.getByRole('button', { name: 'tis 6 okt' }).click();
  await dlg.getByRole('button', { name: 'tis 20 okt' }).click();
  await dlg.getByRole('button', { name: 'Kopiera till 2 dagar' }).click();
  await expect(toast(page)).toContainText('1 dagar hade redan passet');
  await expect(acts(page, '2026-10-06')).toHaveCount(1);
  await expect(acts(page, '2026-10-20')).toHaveCount(1);
});

test('dra ett pass till en annan dag', async ({ page }) => {
  await addActivity(page, '2026-10-13', '7–9 år klass');
  await acts(page, '2026-10-13').dragTo(day(page, '2026-10-15'));
  await expect(acts(page, '2026-10-13')).toHaveCount(0);
  await expect(acts(page, '2026-10-15')).toHaveCount(1);
  await page.keyboard.press('Control+z');
  await expect(acts(page, '2026-10-13')).toHaveCount(1);
});

test('flytta pass med datumfältet', async ({ page }) => {
  await addActivity(page, '2026-10-13', '7–9 år klass');
  await panel(page).getByLabel('Datum').fill('2026-10-21');
  await expect(acts(page, '2026-10-21')).toHaveCount(1);
  await expect(panel(page).getByText('ons 21 okt')).toBeVisible();
});

test('läger visas varje dag från start till slut', async ({ page }) => {
  await addActivity(page, '2026-10-26', 'Läger 7–9 år / 10–12 år');
  await panel(page).getByLabel('Slutdatum').fill('2026-10-30');
  for (const d of ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']) {
    await expect(acts(page, d).locator('.act-title')).toHaveText('Läger 7–9 år / 10–12 år');
  }
  await expect(acts(page, '2026-10-31')).toHaveCount(0);
});

test('kalas: ålder i titeln, e-post vid hovring och kopiering (F15)', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await addActivity(page, '2026-10-10', 'Kalas');
  const p = panel(page);
  await expect(p.getByText('Kalasuppgifter')).toBeVisible();
  await p.getByLabel('Kontakt (e-post)').fill('anna@example.com');
  await p.getByLabel('Ålder').fill('8');
  await p.getByLabel('Antal barn').fill('14');
  await p.getByLabel('Kalasanteckning').fill('Vegansk mat till alla');
  const a = acts(page, '2026-10-10');
  await expect(a.locator('.act-title')).toHaveText('Kalas 8 år');
  const tag = a.getByRole('button', { name: 'E-post' });
  await expect(tag).toHaveAttribute('title', 'anna@example.com');
  await tag.click();
  await expect(toast(page)).toContainText('Kopierade anna@example.com');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('anna@example.com');
  // Kalasanteckningen syns inte i schemat
  await expect(day(page, '2026-10-10')).not.toContainText('Vegansk');
});

test('varningar: pass utan coach och coach på överlappande pass (F18)', async ({ page }) => {
  await addActivity(page, '2026-10-13', '7–9 år klass');
  await expect(acts(page, '2026-10-13')).toHaveClass(/warn/);
  await expect(page.getByTestId('warning-summary')).toHaveText('1 pass utan coach');
  await addCoaches(page, ['Coach 1']);
  await expect(acts(page, '2026-10-13')).not.toHaveClass(/warn/);
  await addActivity(page, '2026-10-13', '7–9 år tjejklass'); // samma tid 17–18
  await addCoaches(page, ['Coach 1']);
  await expect(acts(page, '2026-10-13').nth(0)).toHaveClass(/warn/);
  await expect(acts(page, '2026-10-13').nth(1)).toHaveClass(/warn/);
  await expect(panel(page).locator('.panel-warning')).toContainText('Krockar med ett annat pass: Coach 1');
  await expect(page.getByTestId('warning-summary')).toHaveText('2 pass med krock');
});

test('byt coach i period (F16)', async ({ page }) => {
  for (const d of ['2026-10-13', '2026-10-20', '2026-10-27']) {
    await addActivity(page, d, '7–9 år klass');
    await addCoaches(page, ['Coach 1']);
  }
  await page.getByRole('button', { name: 'Byt coach i period…' }).click();
  const dlg = page.getByTestId('replace-dialog');
  await dlg.getByLabel('Ersätt', { exact: true }).selectOption({ label: 'Coach 1' });
  await dlg.getByLabel('Med', { exact: true }).selectOption({ label: 'Coach 9' });
  await dlg.getByLabel('Från och med').fill('2026-10-26');
  await dlg.getByLabel('Till och med').fill('2026-10-30');
  await dlg.getByRole('button', { name: 'Ersätt' }).click();
  await expect(toast(page)).toContainText('Coach 1 ersattes med Coach 9 på 1 pass');
  expect(await chipNames(acts(page, '2026-10-20'))).toEqual(['Coach 1']);
  expect(await chipNames(acts(page, '2026-10-27'))).toEqual(['Coach 9']);
});

test('byta typ i panelen ändrar titel men inte tid', async ({ page }) => {
  await addActivity(page, '2026-10-13', '7–9 år klass');
  await panel(page).getByLabel('Typ').selectOption({ label: 'Red band' });
  await expect(acts(page, '2026-10-13').locator('.act-title')).toHaveText('Red band');
  await expect(acts(page, '2026-10-13').locator('.act-time')).toHaveText('17:00–18:00');
});
