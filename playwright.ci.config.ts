import { defineConfig } from '@playwright/test';
import { join } from 'node:path';


const pathToChrome = '/usr/bin/google-chrome';
if (!pathToChrome) {
    throw new Error('Should set path to Chrome(Yandex or other Chromium-based browser)');
}
const __dirname = import.meta.dirname;
export default defineConfig({
    testDir: join(__dirname, 'tests'),
    reporter: [
        ['line'],
        ['html', {
            outputFolder: 'playwright-report',
            open: 'never',
        }],
    ],
    timeout: 500_000,
    globalTimeout: 500_000,
    // webServer: {
    //     reuseExistingServer: true,
    //     command: 'npm run start:server -- --port=3004'
    // },
    use: {
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        // defaultBrowserType: 'chromium',
        // browserName: 'chromium',
        headless: true,
        launchOptions: {
            args: [
                '--no-sandbox',
                /** window width / height */
                '--window-size=1920,1080',
            ],
            executablePath: pathToChrome,
            timeout: 600_000,
        },
        contextOptions: {
            viewport: null,
            baseURL: 'http://localhost:3004'
        }
    },
});
