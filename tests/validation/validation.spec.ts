import { expect, test } from '@playwright/test';

test('проверка валидации формы', async ({ page }) => {
    await page.goto('/login');

    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId('app-error')).toBeVisible();
    await expect(page.getByTestId('app-error-code')).toHaveText(/VALIDATION/i);
    await expect(page.getByTestId('role-badge')).toHaveCount(0);

});