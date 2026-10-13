import { test as base, expect, type Page } from "@playwright/test";

// Типы для нашей фикстуры
type TestFixtures = {
    // Можно добавить свои поля, если нужно
    resetDb: () => Promise<void>;
};

// Расширяем базовый test
export const test = base.extend<TestFixtures>({
    // Фикстура resetDb — доступна в тестах как аргумент
    resetDb: async ({ request }, use) => {
        // use() вызывается перед каждым тестом
        await use(async () => {
            const response = await request.get("_qa/reset");
            expect(response.status()).toBe(204);
        });
    },

    // Можно переопределить стандартные фикстуры, добавив к ним поведение
    page: async ({ page }, use) => {
        // Этот хук сработает автоматически перед каждым тестом
        // request доступен через контекст
        await use(page);
    },
});

// Глобальный beforeEach через фикстуру — самый чистый способ
test.beforeEach(async ({ request }) => {
    const response = await request.post("/api/_qa/reset");
    expect(response.status()).toBe(204);
});

export { expect };

// Хелпер для логина (чтобы не дублировать)
export async function loginViaApi(page: Page, login: string, password: string) {
    const response = await page.context().request.post("/api/login", {
        data: { login, password },
    });
    expect(response.status()).toBe(200);
}