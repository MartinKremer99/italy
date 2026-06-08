import { expect, test } from '@playwright/test';

test.describe('Italy Roadtrip 2026', () => {
  test('loads Planen without console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await expect(page).toHaveTitle(/Italien-Roadtrip 2026/);
    await expect(page.locator('.flow-hero')).toBeVisible();
    await expect(page.locator('#flow-progress')).toBeHidden();

    expect(errors.filter((e) => !e.includes('favicon'))).toEqual([]);
  });

  test('Details tab shows progress and full bookings', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Details', exact: true }).click();

    await expect(page.locator('#flow-progress')).toBeVisible();
    await expect(page.locator('#bookings-filter-select')).toBeVisible();
    await expect(page.locator('#view-toggle-full')).toHaveClass(/is-active/);
    await expect(
      page.locator('#bookings-list [data-booking-id], #bookings-list .empty-state').first()
    ).toBeVisible();
    await expect(page.locator('#btn-export')).toBeVisible();
  });

  test('Reise mode: map, cockpit, status badges', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await page.getByRole('button', { name: 'Reise', exact: true }).click();

    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.cockpit, .cockpit-empty').first()).toBeVisible();
    await expect(page.locator('.day-card__badges .status-badge').first()).toBeVisible();
    await expect(page.locator('#btn-reise-heute')).toBeDisabled();

    expect(errors).toEqual([]);
  });

  test('mobile sticky day navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Reise', exact: true }).click();
    await page.locator('.leaflet-container').waitFor({ timeout: 15_000 });
    await expect(page.locator('#reise-day-nav')).toBeVisible();

    const next = page.locator('#btn-day-next');
    if (await next.isEnabled()) {
      await next.click();
      await expect(page.locator('.day-card--selected')).toHaveCount(1);
    }
  });

  test('offline banner when offline', async ({ page, context }) => {
    await page.goto('/');
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.locator('#offline-banner')).toBeVisible();
    await context.setOffline(false);
  });

  test('trip globals are registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() =>
      Boolean(
        globalThis.TRIP_DATA?.days?.length &&
          globalThis.TripUtils?.formatDateDE &&
          globalThis.TripRender?.renderFlowIntro &&
          globalThis.TripFlow?.introSentence &&
          globalThis.TripApp?.switchMode
      )
    );
  });
});
