## Задача 31. CatalogPage: витрина без портянки

### Зачем эта задача

В модуле 3 тесты каталога делали примерно одно и то же:

```ts
await page.getByTestId("catalog-search").fill("тетра");
await page.getByTestId("catalog-search").press("Enter");
await page.getByTestId("catalog-category").selectOption("notebooks");
await page.getByTestId("catalog-sort").selectOption("price:asc");
```

Это можно собрать в `CatalogPage`.

Но важно не переусердствовать.

Плохо:

```ts
catalog.expectSortedByPriceAsc();
```

Хорошо:

```ts
await catalog.sortBy("price:asc");

const prices = await readPricesFromVisibleRows();

expect(prices[1]).toBeGreaterThanOrEqual(prices[0]);
```

Потому что:

```text
Страница умеет управлять каталогом.
Тест решает, что считать правильной сортировкой.
```

### Цепочка задачи

```text
Правило продукта:
Каталог поддерживает поиск, категорию и сортировку.
Пустой поиск не ошибка.
Сортировка цены проверяется по числам.

Риск:
Если локаторы каталога размазаны по тестам,
правка таблицы или фильтров ломает много файлов.

Проверка:
Вынести локаторы и действия каталога в CatalogPage.

Наблюдаемый факт:
Тесты поиска, пустого поиска и сортировки остались понятными
и не потеряли оракулы.

Автотест:
Три теста на основе задач 10 и 12.
```

### Дано в стиле BDD

```gherkin
Feature: Каталог через page object

  Scenario: Поиск по подстроке
    Given я вошла как "anna" и открыла каталог
    When я ищу "тетра"
    Then в таблице есть строки
    And каждая видимая строка содержит "тетра"

  Scenario: Поиск без совпадений не ошибка
    Given я вошла как "anna" и открыла каталог
    When я ищу запрос, которого нет в витрине
    Then строк в таблице нет
    And модалка ошибки скрыта

  Scenario: Сортировка по цене смотрит на числа
    Given я вошла как "anna" и открыла каталог
    When я включаю сортировку по цене по возрастанию
    Then каждая следующая видимая цена не меньше предыдущей
```

### Что нужно сделать

Создать файл:

```text
pages/catalog-page.ts
```

Добавить:

- поле поиска;
- селект категории;
- селект сортировки;
- строки таблицы;
- пагинацию;
- методы действий: `search()`, `selectCategory()`, `sortBy()`;
- доступ к цене строки.

Не нужно класть в `CatalogPage`:

- логин;
- проверку роли;
- ожидания успеха;
- `expect` внутри страницы.

### Пример `pages/catalog-page.ts`

```ts
import { type Page, type Locator } from "@playwright/test";

export class CatalogPage {
  page: Page;

  searchInput: Locator;
  categorySelect: Locator;
  sortSelect: Locator;
  rows: Locator;
  pagination: Locator;

  constructor(page: Page) {
    this.page = page;

    this.searchInput = page.getByTestId("catalog-search");
    this.categorySelect = page.getByTestId("catalog-category");
    this.sortSelect = page.getByTestId("catalog-sort");
    this.rows = page.getByTestId("catalog-row");
    this.pagination = page.getByTestId("catalog-pagination");
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.searchInput.press("Enter");
  }

  async selectCategory(value: string) {
    await this.categorySelect.selectOption(value);
  }

  async sortBy(value: string) {
    await this.sortSelect.selectOption(value);
  }

  rowPrice(row: Locator): Locator {
    return row.getByTestId("catalog-price");
  }
}
```

### Вспомогательный вход в каталог

Это ещё не фикстура.  
Просто функция, чтобы не повторять логин в трёх тестах одного файла.

```ts
import { type Page } from "@playwright/test";
import { LoginPage } from "./login-page";

export async function openCatalogAsAnna(page: Page) {
  const loginPage = new LoginPage(page);

  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass");

  await expect(page).toHaveURL(/\/catalog/);
}
```

### Пример тестов

```ts
import { test, expect } from "@playwright/test";
import { CatalogPage } from "../pages/catalog-page";
import { AppErrorModal } from "../components/app-error-modal";
import { openCatalogAsAnna } from "../helpers/open-catalog-as-anna";

test("поиск тетра оставляет только подходящие строки", async ({ page }) => {
  await openCatalogAsAnna(page);

  const catalog = new CatalogPage(page);

  await catalog.search("тетра");

  await expect(catalog.rows).not.toHaveCount(0);

  const count = await catalog.rows.count();

  for (let i = 0; i < count; i += 1) {
    await expect(catalog.rows.nth(i)).toContainText(/тетра/i);
  }
});

test("поиск без совпадений — пустая таблица, не модалка", async ({ page }) => {
  await openCatalogAsAnna(page);

  const catalog = new CatalogPage(page);
  const errorModal = new AppErrorModal(page);

  await catalog.search("zzzz-no-such");

  await expect(catalog.rows).toHaveCount(0);
  await expect(errorModal.root).toBeHidden();
});

test("сортировка по цене по возрастанию проверяется по числам", async ({ page }) => {
  await openCatalogAsAnna(page);

  const catalog = new CatalogPage(page);

  await catalog.sortBy("price:asc");

  await expect(catalog.rows).toHaveCount(10);

  const prices: number[] = [];

  for (let i = 0; i < 10; i += 1) {
    const priceAttribute = await catalog
      .rowPrice(catalog.rows.nth(i))
      .getAttribute("data-price");

    expect(priceAttribute).not.toBeNull();

    prices.push(Number(priceAttribute));
  }

  for (let i = 1; i < prices.length; i += 1) {
    expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
  }
});
```

### Пояснение про сортировку

В нашем клиенте селект сортировки хранит значение:

```text
price:asc
```

Поэтому:

```ts
await catalog.sortBy("price:asc");
```

Если в твоём приложении направление отдельное, то можно сделать метод:

```ts
async sortByPrice(direction: "asc" | "desc")
```

Но пока лучше не усложнять.

### Мини-ревью

1. Тест спрашивает «цены идут по возрастанию?» или просит страницу «проверить сортировку»?
2. Можно ли поменять поиск или селект категории в одном месте?
3. Не появился ли в `CatalogPage` логин?

### Сигналы, что слой начал мешать

- Внутри `CatalogPage` появился `expect`.
- Появился метод `checkSorted()`.
- Тест не может объяснить, какой именно факт проверяет.
- `CatalogPage` наследуется от `LoginPage`.

### Полезные ссылки

- [Page Object Model](https://playwright.dev/docs/pom)
- [Locators](https://playwright.dev/docs/locators)
- [Assertions](https://playwright.dev/docs/test-assertions)

