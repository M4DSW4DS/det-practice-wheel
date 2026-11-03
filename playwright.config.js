// playwright.config.js
module.exports = {
    testDir: './tests',
    timeout: 300000,
    fullyParallel: false,
    reporter: [['list'], ['html', { outputFolder: 'playwright-report' }]],
    use: {
        baseURL: 'https://M4DSW4DS.github.io/det-practice-wheel/',
        headless: false,
        viewport: { width: 1400, height: 900 },
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        trace: 'retain-on-failure',
    },
};