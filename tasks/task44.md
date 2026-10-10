## Задача 44. Таймаут

### Зачем эта задача

Сервер может не падать с ошибкой, а просто молчать слишком долго.

В нашем приложении есть учебный заголовок:

```text
X-Debug-Delay-Ms: 15000
```

Сервер будет спать 15 секунд.  
У клиента есть таймаут около 5 секунд.

Правильный факт:

```text
пользователь видит ошибку сети;
код ошибки — NETWORK;
приложение не висит бесконечно.
```

### Цепочка задачи

```text
Правило продукта:
Если сервер не отвечает вовремя, пользователь видит сетевую ошибку.

Риск:
Если клиент будет ждать вечно, интерфейс зависнет.
Если он молча покажет пустую таблицу, пользователь не поймёт, что сеть виновата.

Проверка:
Включить учебную задержку больше клиентского таймаута.

Наблюдаемый факт:
Модалка ошибки видна.
Код ошибки — NETWORK.

Автотест:
Логин Анны, затем запрос каталога с задержкой.
```

### Дано в стиле BDD

```gherkin
Feature: Таймаут каталога

  Scenario: Долгий сервер превращается в сетевую ошибку
    Given я вошла как "anna"
    When запрос каталога искусственно задерживается на 15000 мс
    Then клиент прерывает ожидание
    And я вижу модалку ошибки с кодом NETWORK
```

### Что нужно сделать

1. Войти как Анна.
2. Включить заголовок `X-Debug-Delay-Ms: 15000`.
3. Спровоцировать новый запрос каталога.
4. Дождаться модалки ошибки.
5. Проверить код `NETWORK`.

Не нужно использовать:

```ts
await page.waitForTimeout(5000);
```

Клиент сам прервёт запрос по своему таймауту.

### Пример кода

```ts
import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/login-page";
import { CatalogPage } from "../pages/catalog-page";
import { AppErrorModal } from "../components/app-error-modal";

test("долгий запрос каталога даёт сетевую ошибку", async ({ page }) => {
  const loginPage = new LoginPage(page);
  const catalog = new CatalogPage(page);
  const errorModal = new AppErrorModal(page);

  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass");

  await expect(page).toHaveURL(/\/catalog/);

  await page.setExtraHTTPHeaders({
    "X-Debug-Delay-Ms": "15000",
  });

  await catalog.searchInput.press("Enter");

  await expect(errorModal.root).toBeVisible({ timeout: 15000 });
  await expect(errorModal.code).toHaveText("NETWORK");
});
```

### Мини-ревью

1. Тест ждёт состояние, а не спит 5 секунд?
2. Проверен именно `NETWORK`, а не `500`?
3. Задержка включена после логина?

### Сигналы, что задача поехала не туда

- `waitForTimeout(5000)` вместо ожидания модалки.
- Заголовок задержки ставится до входа.
- Тест ожидает 503 вместо таймаута.
- Модалка есть, но код ошибки не проверен.

### Полезные ссылки

- [Network](https://playwright.dev/docs/network)
- [Trace viewer](https://playwright.dev/docs/trace-viewer)

