import { expect, test } from '@playwright/test';

test('пользователь входит в систему с неправильным паролем', async ({ page }) => {
    await page.goto('/login');

    await page.getByTestId('login-input').fill('anna');
    await page.getByTestId('password-input').fill('kira-admin');
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId('app-error')).toBeVisible();
    await expect(page.getByTestId('app-error-code')).toHaveText(/UNAUTHORIZED/i);
    await expect(page.getByTestId('role-bage')).toHaveCount(0);

});
