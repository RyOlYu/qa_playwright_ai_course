import { defineConfig } from '@playwright/test';
import { join } from 'node:path';


const pathToChrome = '/home/Tomheten/chrome-linux64/chrome';
if (!pathToChrome) {
    throw new Error('Should set path to Chrome(Yandex or other Chromium-based browser)');
}
export default defineConfig({
    testDir: join(import.meta.dirname, 'tests'),
    reporter: [
        ['line'], // в консоль во время прогона
        // ['html', {
        //     outputFolder: 'playwright-report', // папка (по умолчанию)
        //     open: 'never', // 'always' | 'never' | 'on-failure'
        // }],
        // ['allure-playwright', {
        //     detail: true, // шаги внутри теста
        //     outputFolder: 'allure-results', // сырые JSON файлы
        //     suiteTitle: false, // не дублировать describe в заголовке
        // }],
    ],
    timeout: 30_000,
    globalTimeout: 30_000,
    webServer: {
        command: 'npm run start:server'
    },
    use: {
        screenshot: 'on',
        trace: 'off',
        defaultBrowserType: 'chromium',
        browserName: 'chromium',
        headless: false,
        launchOptions: {
            args: [
                '--no-sandbox',
                /** window width / height */
                '--window-size=1920,1080',
            ],
            timeout: 30_000,
            // slowMo: 1000
        },
        contextOptions: {
            viewport: null,
            baseURL: 'http://localhost:3004'
        }
    },
});
