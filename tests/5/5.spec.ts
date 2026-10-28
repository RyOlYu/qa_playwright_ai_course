import { expect, test } from "@playwright/test";

test('вход зарегистрированного пользователя', async ({ page }) => {
    await page.goto('/login');

    await page.getByTestId('login-input').fill('anna');
    await page.getByTestId('password-input').fill('anna-pass');
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/catalog/);
    await expect(page.getByTestId('role-badge')).toHaveText(/user/i);
    await expect(page.getByTestId('nav-admin-products')).toHaveCount(0);
    await expect(page.getByTestId('app-modal-error')).toBeHidden();
});

