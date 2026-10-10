## Задача 33. Два `storageState`: две личности

### Зачем эта задача

Фикстура из задачи 32 уже убирает копипасту входа, но всё равно каждый раз кликает форму.

Для каталожных тестов это медленно.

Playwright умеет сохранить состояние после одного входа:

```text
куки;
локальные данные, если они есть;
сессию.
```

Это называется:

```text
storageState
```

Для нашего приложения важно:

```text
Анна и Кира — два разных файла.
```

Нельзя:

```text
войти Кирой;
потом в том же состоянии сказать «теперь будь Анной».
```

Роль нельзя «донастроить» через интерфейс.  
Роль подтверждается сессией и сервером.

### Цепочка задачи

```text
Правило продукта:
Анна и Кира имеют разные роли и разные видимые контролы.

Риск:
Если использовать один файл состояния на двоих,
тесты начнут врать про роли.

Проверка:
Сохранить два файла:
- anna.json;
- kira.json.

Наблюдаемый факт:
Анна из сохранённого состояния видит каталог как пользователь.
Кира из сохранённого состояния видит каталог как администратор.

Автотест:
Тесты без кликов по форме входа.
```

### Дано в стиле BDD

```gherkin
Feature: Две сохранённые сессии

  Scenario: Сессия Анны не даёт админку
    Given сохранён storageState пользователя "anna"
    When я открываю каталог без формы входа
    Then в шапке виден бейдж роли "user"
    And пункта «Товары» нет

  Scenario: Сессия Киры не превращается в Анну
    Given сохранён storageState администратора "kira"
    When я открываю каталог без формы входа
    Then в шапке виден бейдж роли "admin"
    And пункт «Товары» виден
```

### Что нужно сделать

Создать подготовку:

```text
tests/auth.setup.ts
```

В ней:

1. войти как Анна;
2. сохранить состояние в `playwright/.auth/anna.json`;
3. войти как Кира;
4. сохранить состояние в `playwright/.auth/kira.json`.

Дальше в конфиге или в фикстурах использовать эти файлы.

### Пример `tests/auth.setup.ts`

```ts
import { test as setup, expect } from "@playwright/test";
import { LoginPage } from "../pages/login-page";

setup("сохранить состояние Анны", async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass");

  await expect(page).toHaveURL(/\/catalog/);

  await page.context().storageState({
    path: "playwright/.auth/anna.json",
  });
});

setup("сохранить состояние Киры", async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.open();
  await loginPage.signIn("kira", "kira-admin");

  await expect(page).toHaveURL(/\/catalog/);

  await page.context().storageState({
    path: "playwright/.auth/kira.json",
  });
});
```

### Пример фрагмента конфига

```ts
projects: [
  {
    name: "setup",
    testMatch: /auth\.setup\.ts/,
  },
  {
    name: "as-anna",
    dependencies: ["setup"],
    use: {
      storageState: "playwright/.auth/anna.json",
    },
  },
  {
    name: "as-kira",
    dependencies: ["setup"],
    use: {
      storageState: "playwright/.auth/kira.json",
    },
  },
];
```

Если в учебном шаблоне нельзя трогать конфиг, можно читать `storageState` через фикстуры или `browser.newContext()`.  
Но смысл должен остаться:

```text
Анна — свой файл.
Кира — свой файл.
```

### Пример теста для Анны

```ts
import { test, expect } from "@playwright/test";

test("Анна из сохранённого состояния видит каталог как покупатель", async ({ page }) => {
  await page.goto("/catalog");

  await expect(page.getByTestId("role-badge")).toHaveText(/user/i);
  await expect(page.getByTestId("nav-admin-products")).toHaveCount(0);
  await expect(page.getByTestId("login-form")).toHaveCount(0);
});
```

### Пример теста для Киры

```ts
import { test, expect } from "@playwright/test";

test("Кира из сохранённого состояния видит каталог как администратор", async ({ page }) => {
  await page.goto("/catalog");

  await expect(page.getByTestId("role-badge")).toHaveText(/admin/i);
  await expect(page.getByTestId("nav-admin-products")).toBeVisible();
  await expect(page.getByTestId("login-form")).toHaveCount(0);
});
```

### Важно про безопасность

Файлы:

```text
playwright/.auth/anna.json
playwright/.auth/kira.json
```

не нужно коммитить в репозиторий.

Добавь в `.gitignore`:

```text
playwright/.auth/
```

### Мини-ревью

1. У Анны и Киры разные файлы состояния?
2. Тесты запускаются без кликов по форме входа?
3. Не пытаемся ли мы «переключить роль» внутри одного контекста?

### Сигналы, что `storageState` используется неправильно

- Один файл состояния на двоих.
- Сначала вошли Кирой, потом перезаписали файл Анной.
- Роль меняется через `page.evaluate()` в бейдже.
- Тесты Анны и Киры запускаются в одном проекте с одним `storageState`.
- Файл состояния попал в репозиторий.

### Полезные ссылки

- [Authentication](https://playwright.dev/docs/auth)
- [Test Fixtures](https://playwright.dev/docs/test-fixtures)
- [Best Practices](https://playwright.dev/docs/best-practices)

