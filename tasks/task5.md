## Задача 5. Анна входит как обычный пользователь

### Зачем эта задача

Это первый полноценный пользовательский сценарий:

1. открыть страницу входа;
2. ввести данные;
3. нажать кнопку;
4. увидеть, что приложение приняло пользователя и дало ему правильную роль.

Здесь важно проверить не только «куда-то попали», но и что роль видна в интерфейсе, а админские пункты не доступны.

### Немного теории своими словами

Хороший автотест отвечает на вопрос из требований.

Вопрос этой задачи:

> Если обычный пользователь входит с верными данными, видит ли он каталог и не видит ли администраторские функции?

Ожидаемый факт:

- URL содержит `/catalog`;
- в шапке виден бейдж роли `user`;
- пункт `nav-admin-products` отсутствует;
- модалка ошибки не видима.

Важно не использовать `waitForTimeout`.  
Playwright сам умеет ждать, пока элемент появится, исчезнет или станет видимым.

### Дано в стиле BDD

```gherkin
Feature: Вход обычного пользователя

  Scenario: Покупатель входит и не видит администраторские пункты
    Given я гость на странице входа
    When я вхожу как "anna" с паролем "anna-pass"
    Then я оказываюсь в каталоге
    And в шапке виден бейдж роли "user"
    And пункта «Товары» нет
    And модалка ошибки скрыта
```

### Что нужно сделать

Написать тест:

1. открыть `/login`;
2. ввести логин `anna`;
3. ввести пароль `anna-pass`;
4. нажать `login-submit`;
5. проверить, что браузер оказался на каталоге;
6. проверить бейдж роли;
7. проверить, что админ-пункта нет;
8. проверить, что модалка ошибки скрыта.

### Пример решения

```ts
import { test, expect } from '@playwright/test';

test('Анна входит как покупатель и не видит админ-пункт', async ({ page }) => {
  await page.goto('/login');

  await page.getByTestId('login-input').fill('anna');
  await page.getByTestId('password-input').fill('anna-pass');
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(/\/catalog/);
  await expect(page.getByTestId('role-badge')).toHaveText(/user/i);
  await expect(page.getByTestId('nav-admin-products')).toHaveCount(0);
  await expect(page.getByTestId('app-error')).toBeHidden();
});
```

### Пояснение к последнему ожиданию

В нашем клиенте модалка ошибки присутствует в DOM, но в обычном состоянии скрыта.  
Поэтому здесь уместно использовать:

```ts
await expect(page.getByTestId('app-error')).toBeHidden();
```

Если бы модалка вообще не рендерилась до ошибки, тогда можно было бы использовать:

```ts
await expect(page.getByTestId('app-error')).toHaveCount(0);
```

В обоих случаях важно не просто проверять, что «страница изменилась», а проверять наблюдаемый факт.

### Что считается сделанным

Сделано, если:

- тест входит как `anna`;
- после входа проверяется каталог;
- проверяется бейдж роли;
- проверяется отсутствие админ-пункта;
- нет `waitForTimeout`;
- тест читается как простой пользовательский сценарий.

### Анти-паттерны

Плохо:

```ts
await page.getByTestId('login-submit').click();
await page.waitForTimeout(2000);
```

Плохо:

```ts
await expect(page).toHaveURL('http://localhost:3000/catalog');
```

Лучше использовать регулярное выражение или путь без жёстко вшитого порта:

```ts
await expect(page).toHaveURL(/\/catalog/);
```

### Полезные ссылки

- [Playwright Assertions](https://playwright.dev/docs/test-assertions)
- [Playwright Actionability](https://playwright.dev/docs/actionability)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

