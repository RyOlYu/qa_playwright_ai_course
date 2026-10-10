import { expect, test } from './../../fixtures';

test('Анна входит как покупатель и не видит админ-пункт', async ({ page }) => {
    await page.goto('/login');

    await page.getByTestId('login-input').fill('anna');
    await page.getByTestId('password-input').fill('anna-pass');
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/catalog/);
    await expect(page.getByTestId('role-badge')).toHaveText(/user/i);
    await expect(page.getByTestId('nav-admin-products')).toHaveCount(0);
    await expect(page.getByTestId('app-error')).toBeHidden();
});