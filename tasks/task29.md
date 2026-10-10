## Задача 29. LoginPage: тесты становятся тоньше

### Зачем эта задача

Раньше тест входа выглядел так:

```ts
await page.getByTestId("login-input").fill("anna");
await page.getByTestId("password-input").fill("anna-pass");
await page.getByTestId("login-submit").click();
```

И это повторялось в нескольких задачах.

Сам по себе код не плохой.  
Он плохой тем, что не даёт понять, какое правило проверяется.

После вынесения формы входа в объект тест должен читаться ближе к сценарию:

```text
Открыть страницу входа.
Войти как Анна.
Проверить каталог и бейдж роли.
```

### Цепочка задачи

```text
Правило продукта:
Логин позволяет Анне войти как покупателю.
Неверный пароль не пускает.
Пустые поля дают валидацию.

Риск:
Если локаторы формы размазаны по тестам,
изменение одного поля ломает много файлов.

Проверка:
Вынести локаторы и действия страницы входа в LoginPage.

Наблюдаемый факт:
Тесты остались тонкими:
- вход Анны;
- неверный пароль;
- пустые поля.

Автотест:
Три теста используют LoginPage, но ожидания остаются в тестах.
```

### Термины на сегодня

**Page Object** — объект, который знает, где лежат элементы страницы и как с ними взаимодействовать.

**Тонкий тест** — тест, в котором видно сценарий и ожидаемый факт, а повторяющиеся клики спрятаны в страницу.

Идея из документации Playwright своими словами:

> Страница абстрагирует вёрстку и действия с ней.  
> Тест остаётся спецификацией поведения.

### Дано в стиле BDD

```gherkin
Feature: Вход через страницу логина

  Scenario: Покупатель входит и не видит админку
    Given я гость на странице входа
    When я вхожу как "anna" с паролем "anna-pass"
    Then я оказываюсь в каталоге
    And в шапке виден бейдж роли "user"
    And пункта «Товары» нет

  Scenario: Неверный пароль не пускает в каталог
    Given я гость на странице входа
    When я вхожу как "anna" с неверным паролем
    Then я остаюсь на странице входа
    And вижу модалку ошибки с кодом 401

  Scenario: Пустые поля дают валидацию
    Given я гость на странице входа
    When я нажимаю «Войти», ничего не вводя
    Then я остаюсь на странице входа
    And вижу модалку ошибки с кодом 422
```

### Что нужно сделать

Создать файл:

```text
pages/login-page.ts
```

Минимально:

- открыть `/login`;
- ввести логин и пароль;
- нажать кнопку входа;
- отправить пустую форму.

Важно:

```text
signIn() не должен ожидать каталог.
```

Потому что `signIn()` используется и для успешного входа, и для входа с ошибкой.

Если внутри `signIn()` написать:

```ts
await expect(page).toHaveURL(/\/catalog/);
```

то тесты на 401 и 422 сломают этот метод.

### Пример `pages/login-page.ts`

```ts
import { type Page, type Locator } from "@playwright/test";

export class LoginPage {
  page: Page;

  form: Locator;
  loginInput: Locator;
  passwordInput: Locator;
  submitButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.form = page.getByTestId("login-form");
    this.loginInput = page.getByTestId("login-input");
    this.passwordInput = page.getByTestId("password-input");
    this.submitButton = page.getByTestId("login-submit");
  }

  async open() {
    await this.page.goto("/login");
  }

  async signIn(login: string, password: string) {
    await this.loginInput.fill(login);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async submitEmpty() {
    await this.submitButton.click();
  }
}
```

### Пример тестов

```ts
import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/login-page";

test("Анна входит как покупатель", async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass");

  await expect(page).toHaveURL(/\/catalog/);
  await expect(page.getByTestId("role-badge")).toHaveText(/user/i);
  await expect(page.getByTestId("nav-admin-products")).toHaveCount(0);
  await expect(page.getByTestId("app-error")).toBeHidden();
});

test("неверный пароль оставляет на странице входа", async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass-nope");

  await expect(page.getByTestId("app-error")).toBeVisible();
  await expect(page.getByTestId("app-error-code")).toHaveText("401");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByTestId("role-badge")).toHaveCount(0);
});

test("пустые поля дают валидацию, а не 401", async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.open();
  await loginPage.submitEmpty();

  await expect(page.getByTestId("app-error")).toBeVisible();
  await expect(page.getByTestId("app-error-code")).toHaveText("422");
  await expect(page).toHaveURL(/\/login/);
});
```

### Мини-ревью

1. Тест читается как сценарий входа?
2. Есть ли ожидания в `LoginPage`, которых там быть не должно?
3. Можно ли использовать `signIn()` и для успеха, и для ошибки?

### Сигналы, что страница поехала не туда

- Внутри `signIn()` появился `expect`.
- `LoginPage` знает, что Анна должна попасть в каталог.
- Тест стал одной строкой, но перестал показывать, какой факт проверяется.
- Появился метод `loginSuccessfullyAsAnna()`, рядом `loginUnsuccessfullyWithWrongPassword()`, и дальше методы начинают размножаться.

### Полезные ссылки

- [Page Object Model](https://playwright.dev/docs/pom)
- [Locators](https://playwright.dev/docs/locators)
- [Assertions](https://playwright.dev/docs/test-assertions)

