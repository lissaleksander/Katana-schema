import { test as base, expect, type Page } from '@playwright/test';

export { expect };

/** Som Playwrights test, men varje test underkänns om sidan loggar fel. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console: ${m.text()}`);
      });
      await use(errors);
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});

export const TODAY = new Date('2026-10-26T10:00:00+01:00');

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Startar appen med en fast "idag". */
export async function start(page: Page, opts: { time?: Date } = {}) {
  await page.clock.setFixedTime(opts.time ?? TODAY);
  await page.goto('/');
  await expect(page.locator('.toolbar')).toBeVisible();
}

export async function createMonth(page: Page, opts: { month?: string; copyFrom?: string; withoutCoaches?: boolean } = {}) {
  await page.getByRole('button', { name: '+ Ny månad' }).first().click();
  const dlg = page.getByTestId('new-month-dialog');
  await expect(dlg).toBeVisible();
  if (opts.month) await dlg.getByLabel('Månad', { exact: true }).selectOption({ label: opts.month });
  if (opts.copyFrom) {
    await dlg.getByLabel('Kopiera från').check();
    await dlg.getByLabel('Källmånad').selectOption({ label: opts.copyFrom });
    if (opts.withoutCoaches) await dlg.getByLabel('Kopiera utan coacher').check();
  } else {
    await dlg.getByLabel('Tom månad').check();
  }
  await dlg.getByRole('button', { name: 'Skapa' }).click();
}

export function day(page: Page, date: string) {
  return page.locator(`.calendar-edit .day[data-date="${date}"]`);
}

export function acts(page: Page, date: string) {
  return day(page, date).locator('.act');
}

/** Lägger till ett pass via "+" i dagrutan och väljer typ. Passet blir valt. */
export async function addActivity(page: Page, date: string, typeName: string) {
  await day(page, date).hover();
  await day(page, date).locator('.day-add').click();
  const dlg = page.getByTestId('add-activity-dialog');
  await expect(dlg).toBeVisible();
  await dlg
    .locator('.type-option', { has: page.locator('span', { hasText: new RegExp(`^${esc(typeName)}$`) }) })
    .click();
  await expect(dlg).toBeHidden();
}

export function panel(page: Page) {
  return page.getByTestId('side-panel');
}

/** Lägger till coacher på valt pass via panelen. */
export async function addCoaches(page: Page, names: string[]) {
  for (const n of names) {
    const toggle = panel(page).getByRole('button', { name: '+ Lägg till coach' });
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    await panel(page).locator('.coach-picker .chip', { hasText: new RegExp(`^${esc(n)}$`) }).click();
  }
}

export async function chipNames(loc: ReturnType<Page['locator']>) {
  return loc.locator('.act-coaches .chip-name').allTextContents();
}

export function toast(page: Page) {
  return page.getByTestId('toast');
}

/** Väntar tills automatisk sparning i webbläsaren har hunnit köras. */
export async function waitForAutosave(page: Page) {
  await page.waitForTimeout(600);
}
