## Задача 30. Модалка ошибки — один компонент на все отказы

### Зачем эта задача

В приложении одна модалка на все отказы:

```text
401 на логине
422 на пустых полях
403 на админской странице
503 из-за учебного сбоя
```

Если каждый тест будет сам писать:

```ts
page.getByTestId("app-error")
page.getByTestId("app-error-code")
page.getByTestId("app-error-message")
page.getByTestId("app-error-close")
```

то при изменении модалки придётся править много файлов.

Но и создавать два класса:

```text
LoginErrorModal
AdminErrorModal
```

нельзя.

Потому что в продукте модалка одна.  
Разные коды — это разные правила, но окно одно.

### Цепочка задачи

```text
Правило продукта:
Все отказы показываются в одной модалке.

Риск:
Если разнести модалку по тестам или по классам,
потеряется факт, что это один и тот же компонент.

Проверка:
Сделать один component object для модалки.

Наблюдаемый факт:
Тесты 401 и 403 используют один объект,
но проверяют разные коды.

Автотест:
Неверный пароль показывает 401 и закрывается.
Анна на /admin/products видит 403.
```

### Дано в стиле BDD

```gherkin
Feature: Одна модалка на отказы

  Scenario: Неверный пароль показывает 401
    Given я гость на странице входа
    When я вхожу как "anna" с неверным паролем
    Then вижу модалку ошибки с кодом 401
    When я закрываю модалку
    Then модалка исчезает
    And я остаюсь на странице входа

  Scenario: Покупатель на админской странице видит 403
    Given я вошла как "anna"
    When я открываю "/admin/products"
    Then вижу модалку ошибки с кодом 403
```

### Что нужно сделать

Создать файл:

```text
components/app-error-modal.ts
```

Он должен давать доступ к:

- корню модалки;
- коду ошибки;
- тексту ошибки;
- кнопке закрытия;
- действию `close()`.

Он не должен решать:

```text
401 это хорошо или плохо;
403 должен быть для Анны или нет;
какой пароль ввела Анна.
```

Это знает тест.

### Пример `components/app-error-modal.ts`

```ts
import { type Page, type Locator } from "@playwright/test";

export class AppErrorModal {
  page: Page;

  root: Locator;
  code: Locator;
  message: Locator;
  closeButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.root = page.getByTestId("app-error");
    this.code = page.getByTestId("app-error-code");
    this.message = page.getByTestId("app-error-message");
    this.closeButton = page.getByTestId("app-error-close");
  }

  async close() {
    await this.closeButton.click();
  }
}
```

### Пример тестов

```ts
import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/login-page";
import { AppErrorModal } from "../components/app-error-modal";

test("401 на логине показывается общей модалкой и закрывается", async ({ page }) => {
  const loginPage = new LoginPage(page);
  const errorModal = new AppErrorModal(page);

  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass-nope");

  await expect(errorModal.root).toBeVisible();
  await expect(errorModal.code).toHaveText("401");

  await errorModal.close();

  await expect(errorModal.root).toBeHidden();
  await expect(page).toHaveURL(/\/login/);
});

test("Анна на админской странице видит 403 в той же модалке", async ({ page }) => {
  const loginPage = new LoginPage(page);
  const errorModal = new AppErrorModal(page);

  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass");

  await expect(page).toHaveURL(/\/catalog/);

  await page.goto("/admin/products");

  await expect(errorModal.root).toBeVisible();
  await expect(errorModal.code).toHaveText("403");
});
```

### Пояснение

Второй тест проверяет не гостя.  
Гость на `/admin/products` должен попасть на логин — это другое правило.

Здесь `Given` другой:

```text
Сессия Анны жива, но прав администратора нет.
```

Поэтому ожидаем:

```text
403
```

а не редирект на `/login`.

### Мини-ревью

1. Модалка одна, даже если коды разные?
2. Компонент знает, как закрыть окно, но не знает, почему оно появилось?
3. Не появился ли метод вида `expectLoginError()` или `expectAdminForbidden()`?

### Сигналы, что компонент начал прятать оракул

- Внутри `AppErrorModal` появился `expect`.
- Появились два класса: `LoginErrorModal` и `AdminErrorModal`.
- Тест вызывает `modal.assert401()` и по падению непонятно, что именно не совпало.
- Закрытие проверяется через `Escape`, хотя в приложении есть явная кнопка.

### Полезные ссылки

- [Page Object Model](https://playwright.dev/docs/pom)
- [Assertions](https://playwright.dev/docs/test-assertions)

