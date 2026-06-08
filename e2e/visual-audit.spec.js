import { test } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'e2e-screenshots');

test.describe('visual audit captures', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('capture desktop views', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(600);

    await page.screenshot({ path: path.join(outDir, '01-planen-jetzt-desktop.png'), fullPage: true });

    await page.getByRole('button', { name: 'Details', exact: true }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, '02-planen-details-desktop.png'), fullPage: true });

    await page.getByRole('button', { name: 'Reise', exact: true }).click();
    await page.locator('.leaflet-container').waitFor({ timeout: 15_000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, '03-reise-desktop.png'), fullPage: true });

    await page.locator('#trip-day-strip .day-card').first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, '04-reise-day-expanded-desktop.png'), fullPage: true });
  });

  test.use({ viewport: { width: 390, height: 844 } });

  test('capture mobile views', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, '05-planen-jetzt-mobile.png'), fullPage: true });

    await page.getByRole('button', { name: 'Reise', exact: true }).click();
    await page.locator('.leaflet-container').waitFor({ timeout: 15_000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, '06-reise-mobile.png'), fullPage: true });
  });
});
