import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { acts, addActivity, addCoaches, chipNames, createMonth, expect, start, test, toast, waitForAutosave, TODAY } from './helpers';

/** Tvingar fram reservvägen (nedladdning + filväljare), som i Safari och Firefox. */
async function withoutFileSystemAccess(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
    Object.defineProperty(window, 'showOpenFilePicker', { value: undefined, configurable: true });
  });
}

async function saveViaDownload(page: Page) {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Spara fil' }).first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^katana-schema-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
  return readFileSync((await download.path())!, 'utf8');
}

async function openFile(page: Page, name: string, content: string) {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Öppna fil' }).first().click();
  await (await chooserPromise).setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(content) });
}

test('spara fil och öppna den i en annan webbläsare (F13)', async ({ page, browser }) => {
  await withoutFileSystemAccess(page);
  await start(page);
  await createMonth(page);
  await addActivity(page, '2026-10-13', '7–9 år klass');
  await addCoaches(page, ['Coach 6', 'Coach 4']);
  await expect(page.getByTestId('status-footer')).toContainText('Inte sparad till fil ännu · osparade ändringar');

  const text = await saveViaDownload(page);
  const json = JSON.parse(text);
  expect(json.version).toBe(1);
  expect(json.coaches).toHaveLength(15);
  expect(json.activityTypes).toHaveLength(25);
  expect(json.months).toEqual([{ year: 2026, month: 10, status: 'draft' }]);
  expect(json.activities).toHaveLength(1);
  expect(json.activities[0]).toMatchObject({ date: '2026-10-13', start: '17:00', end: '18:00', typeId: 't6', coachIds: ['c6', 'c4'] });
  await expect(toast(page)).toContainText('Sparat till katana-schema-2026-10-26-1000.json');
  await expect(page.getByTestId('status-footer')).toContainText('Senast sparad till fil: 26 okt. 2026');
  await expect(page.getByTestId('status-footer')).not.toContainText('osparade');

  // "Den andra datorn": en ny, tom webbläsare
  const ctx2 = await browser.newContext({ locale: 'sv-SE', timezoneId: 'Europe/Stockholm' });
  const page2 = await ctx2.newPage();
  await withoutFileSystemAccess(page2);
  await start(page2);
  await expect(page2.getByRole('heading', { name: 'Välkommen!' })).toBeVisible();
  await openFile(page2, 'backup.json', text);
  await page2.getByTestId('confirm-dialog').getByRole('button', { name: 'Ersätt' }).click();
  await expect(page2.getByRole('tab', { name: 'Okt 2026' })).toBeVisible();
  expect(await chipNames(acts(page2, '2026-10-13'))).toEqual(['Coach 6', 'Coach 4']);
  await expect(toast(page2)).toContainText('Läste in backup.json');
  await ctx2.close();
});

test('öppna fil kan avbrytas och ångras', async ({ page }) => {
  await withoutFileSystemAccess(page);
  await start(page);
  await createMonth(page);
  await addActivity(page, '2026-10-13', '7–9 år klass');
  const other = JSON.parse(await saveViaDownload(page));
  other.activities = [];
  other.coaches[0].name = 'Elton';
  const otherText = JSON.stringify(other);

  await openFile(page, 'other.json', otherText);
  await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Avbryt' }).click();
  await expect(acts(page, '2026-10-13')).toHaveCount(1);

  await openFile(page, 'other.json', otherText);
  await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Ersätt' }).click();
  await expect(acts(page, '2026-10-13')).toHaveCount(0);
  await expect(page.locator('.coach-list')).toContainText('Elton');
  await toast(page).getByRole('button', { name: 'Ångra' }).click();
  await expect(acts(page, '2026-10-13')).toHaveCount(1);
  await expect(page.locator('.coach-list')).not.toContainText('Elton');
});

test('trasiga filer avvisas med begripligt fel och utan att något ändras', async ({ page }) => {
  await withoutFileSystemAccess(page);
  await start(page);
  await createMonth(page);
  const cases: [string, string][] = [
    ['inte json', 'Filen är inte en giltig sparfil (inte JSON).'],
    ['{"foo":1}', 'Filen är inte en sparfil från schemaappen.'],
    [
      JSON.stringify({ version: 1, coaches: [], activityTypes: [], activities: [{ id: 'a', date: '2026-10-01', start: '10:00', end: '11:00', typeId: 'x', coachIds: [] }] }),
      'Sparfilen är skadad: fel i aktivitet #1.',
    ],
    [JSON.stringify({ version: 9, coaches: [], activityTypes: [] }), 'nyare version av appen (version 9)'],
  ];
  for (const [i, [content, message]] of cases.entries()) {
    await openFile(page, `bad${i}.json`, content);
    await expect(toast(page)).toContainText(message);
    await expect(page.getByTestId('confirm-dialog')).toHaveCount(0);
    await toast(page).getByRole('button', { name: 'Stäng' }).click();
  }
  await expect(page.getByRole('tab', { name: 'Okt 2026' })).toBeVisible();
});

test('Chrome/Edge: "Spara fil" skriver till samma fil utan ny dialog', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__pickerCalls = 0;
    w.__written = [] as string[];
    const handle = {
      name: 'mitt-schema.json',
      kind: 'file',
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      createWritable: async () => ({
        write: async (b: Blob) => (w.__written as string[]).push(await b.text()),
        close: async () => undefined,
      }),
    };
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async () => {
        (w.__pickerCalls as number)++;
        return handle;
      },
    });
  });
  await start(page);
  await createMonth(page);
  await page.getByRole('button', { name: 'Spara fil' }).click();
  await expect(toast(page)).toContainText('Sparat till mitt-schema.json');
  await addActivity(page, '2026-10-13', '7–9 år klass');
  await page.getByRole('button', { name: 'Spara fil' }).click();
  await expect(page.getByTestId('status-footer')).not.toContainText('osparade');
  const { calls, written } = await page.evaluate(() => {
    const w = window as unknown as { __pickerCalls: number; __written: string[] };
    return { calls: w.__pickerCalls, written: w.__written };
  });
  expect(calls).toBe(1);
  expect(written).toHaveLength(2);
  expect(JSON.parse(written[1]).activities).toHaveLength(1);
  await expect(page.getByTestId('status-footer')).toContainText('mitt-schema.json');
});

test('påminnelse om filen inte sparats på 7 dagar', async ({ page }) => {
  await withoutFileSystemAccess(page);
  await start(page);
  await createMonth(page);
  await waitForAutosave(page);
  await expect(page.getByTestId('save-reminder')).toHaveCount(0);
  await page.clock.setFixedTime(new Date(TODAY.getTime() + 8 * 86_400_000));
  await page.reload();
  await expect(page.getByTestId('save-reminder')).toContainText('aldrig sparats till fil');
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('save-reminder').getByRole('button', { name: 'Spara fil' }).click();
  await downloadPromise;
  await expect(page.getByTestId('save-reminder')).toHaveCount(0);
});

test('Chrome/Edge: ångras en filöppning sparas det åter till den tidigare filen', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    const written: Record<string, string[]> = { 'min.json': [], 'kollegans.json': [] };
    w.__written = written;
    w.__pickerCalls = 0;
    const handle = (name: string, content = '') => ({
      name,
      kind: 'file',
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      getFile: async () => new File([content], name, { type: 'application/json' }),
      createWritable: async () => ({
        write: async (b: Blob) => written[name].push(await b.text()),
        close: async () => undefined,
      }),
    });
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async () => {
        (w.__pickerCalls as number)++;
        return handle('min.json');
      },
    });
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: async () => [handle('kollegans.json', w.__colleague as string)],
    });
  });
  await start(page);
  await createMonth(page);
  await page.getByRole('button', { name: 'Spara fil' }).click();
  await expect(toast(page)).toContainText('Sparat till min.json');
  // Kollegans fil: samma data men utan månader
  await page.evaluate(() => {
    const w = window as unknown as { __written: Record<string, string[]>; __colleague: string };
    const d = JSON.parse(w.__written['min.json'][0]);
    d.months = [];
    w.__colleague = JSON.stringify(d);
  });
  await page.getByRole('button', { name: 'Öppna fil' }).click();
  await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Ersätt' }).click();
  await expect(page.getByRole('heading', { name: 'Välkommen!' })).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('tab', { name: 'Okt 2026' })).toBeVisible();
  await expect(page.getByTestId('status-footer')).toContainText('min.json');
  await page.getByRole('button', { name: 'Spara fil' }).click();
  await expect(toast(page)).toContainText('Sparat till min.json');
  const r = await page.evaluate(() => {
    const w = window as unknown as { __written: Record<string, string[]>; __pickerCalls: number };
    return { calls: w.__pickerCalls, mine: w.__written['min.json'].length, colleague: w.__written['kollegans.json'].length };
  });
  expect(r).toEqual({ calls: 1, mine: 2, colleague: 0 });
});
