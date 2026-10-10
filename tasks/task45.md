## Задача 45. Подмена ответа: пустой список без ошибки

### Зачем эта задача

Иногда нужно проверить не настоящий сервер, а поведение фронта на конкретный ответ.

Например:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 10,
  "total": 0
}
```

Если сервер честно сказал:

```text
товаров нет
```

то фронт должен показать пустую таблицу.  
Не модалку.  
Не 500.  
Не бесконечную загрузку.

Это задача про `page.route`.

### Цепочка задачи

```text
Правило продукта:
Пустой список товаров — нормальное состояние витрины.

Риск:
Если пустой ответ сервера превращается в ошибку,
пользователь будет видеть аварийное окно там, где товаров просто нет.

Проверка:
Подменить ответ каталога на пустой список.

Наблюдаемый факт:
Строк нет.
Сообщение пустого результата видно.
Модалка ошибки не появляется.

Автотест:
Логин Анны, затем подмена ответа /api/products через page.route.
```

### Дано в стиле BDD

```gherkin
Feature: Пустой ответ каталога

  Scenario: Сервер вернул пустой список
    Given я вошла как "anna"
    When ответ каталога подменён на пустой список
    Then я вижу пустую таблицу
    And модалка ошибки не появляется
```

### Что нужно сделать

1. Войти как Анна.
2. Включить `page.route` на `/api/products`.
3. Вернуть пустой `items`.
4. Спровоцировать запрос каталога.
5. Проверить пустую таблицу.
6. Проверить, что модалка ошибки скрыта.

Не нужно подменять логин.  
Не нужно подменять профиль.  
Только каталог.

### Пример кода

```ts
import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/login-page";
import { CatalogPage } from "../pages/catalog-page";
import { AppErrorModal } from "../components/app-error-modal";

test("пустой список товаров показывает пустую таблицу без ошибки", async ({ page }) => {
  const loginPage = new LoginPage(page);
  const catalog = new CatalogPage(page);
  const errorModal = new AppErrorModal(page);

  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass");

  await expect(page).toHaveURL(/\/catalog/);

  await page.route("**/api/products*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [],
        page: 1,
        pageSize: 10,
        total: 0,
      }),
    });
  });

  await catalog.searchInput.press("Enter");

  await expect(catalog.rows).toHaveCount(0);
  await expect(page.getByTestId("catalog-empty")).toBeVisible();

  await expect(errorModal.root).toBeHidden();
});
```

### Мини-ревью

1. Подменяется только каталог, а не весь сайт?
2. Тест отличает пустой список от серверной ошибки?
3. Есть ли проверка `catalog-empty` или хотя бы отсутствия строк?

### Сигналы, что задача поехала не туда

- Мок ставится до входа и ломает логин.
- Подменяется весь `/api/*`.
- Пустая таблица проверяется, но модалка ошибки не проверяется.
- Мок не снимается, хотя контекст и так изолирован — само по себе не страшно, но нужно понимать, почему это ок.

### Полезные ссылки

- [Network](https://playwright.dev/docs/network)
- [Trace viewer](https://playwright.dev/docs/trace-viewer)
- [Assertions](https://playwright.dev/docs/test-assertions)

