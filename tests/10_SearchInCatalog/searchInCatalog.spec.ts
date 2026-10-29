import { expect, Page, test } from '@playwright/test';

async function searchAsAnna(page: Page) {
    await page.goto('/login');

    await page.getByTestId('login-input').fill('anna');
    await page.getByTestId('password-input').fill('anna-pass');
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/catalog/);
}

test('поиск существующего товара', async ({ page }) => {
    await searchAsAnna(page);

    const searchInput = page.getByTestId('catalog-search');

    await searchInput.fill('тетра');
    await searchInput.press('Enter');

    await expect(page).toHaveURL(/q=/);

    const rows = page.getByTestId('catalog-row');

    await expect(rows).toHaveCount(5);
    await expect(rows.filter({ hasText: /тетра/i })).toHaveCount(5);
    await expect(page.getByTestId('app-error')).toBeHidden();
});

test('поиск несуществующего товара', async ({ page }) => {
    await searchAsAnna(page);

    const searchInput = page.getByTestId('catalog-search');

    await searchInput.fill('1111111111');
    await searchInput.press('Enter');

    await expect(page).toHaveURL(/q=/);

    await expect(page.getByTestId('catalog-row')).toHaveCount(0);
    await expect(page.getByTestId('catalog-empty')).toBeVisible();
    await expect(page.getByTestId('app-error')).toBeHidden();

});

