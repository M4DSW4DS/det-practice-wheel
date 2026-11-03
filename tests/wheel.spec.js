// tests/wheel.spec.js
const { test, expect } = require('@playwright/test');

test.describe('DET Practice Wheel - E2E', () => {
    let errors = [];

    test.beforeEach(async ({ page }) => {
        errors = [];
        page.on('pageerror', (err) => {
            errors.push('JS Error: ' + err.message);
            console.log('❌', err.message);
        });
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                errors.push('Console: ' + msg.text());
            }
        });
    });

    test('TC1: Page loads without critical errors', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(2000);
        await expect(page.locator('#spinBtn')).toBeVisible();
        await expect(page.locator('#drumTrack')).toBeVisible();
        const criticalErrors = errors.filter(e => !e.includes('AudioContext'));
        expect(criticalErrors).toEqual([]);
    });

    test('TC2: 30 spins without breaking', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(2000);

        let spins = 0;
        let tasks = 0;
        const MAX_SPINS = 30;

        for (let attempt = 0; attempt < MAX_SPINS * 4 && spins < MAX_SPINS; attempt++) {
            // Открыта модалка задания
            if (await page.locator('#modalOverlay.active').count() > 0) {
                if (await page.locator('#btnFinish').isVisible()) {
                    await page.locator('#btnFinish').click();
                    tasks++;
                } else if (await page.locator('#btnAccept').isEnabled()) {
                    await page.locator('#btnAccept').click();
                } else {
                    await page.locator('#btnClose').click();
                }
                await page.waitForTimeout(300);
                continue;
            }

            // Другие модалки
            const overlays = ['#rewardOverlay', '#catOverlay', '#shieldOverlay', '#masterOverlay', '#qrOverlay', '#luckyOverlay'];
            let closed = false;
            for (const sel of overlays) {
                if (await page.locator(sel + '.active').count() > 0) {
                    if (sel === '#rewardOverlay') {
                        await page.locator('#btnClaimReward').click();
                    } else {
                        await page.locator(sel + ' .btn-close, ' + sel + ' button').first().click({ timeout: 2000 }).catch(() => {
                            page.evaluate((s) => document.querySelector(s).classList.remove('active'), sel);
                        });
                    }
                    closed = true;
                    break;
                }
            }
            if (closed) {
                await page.waitForTimeout(300);
                continue;
            }

            // Крутим
            if (await page.locator('#spinBtn').isVisible()) {
                await page.locator('#spinBtn').click();
                spins++;
                console.log(`🎰 Spin ${spins}/${MAX_SPINS} | Tasks: ${tasks} | Errors: ${errors.length}`);
                await page.waitForTimeout(7500);
            }
        }

        console.log(`\n✅ RESULT: ${spins} spins, ${tasks} tasks completed`);
        const criticalErrors = errors.filter(e => !e.includes('AudioContext'));
        expect(criticalErrors).toEqual([]);
    });

    test('TC3: Keyboard navigation works', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(2000);

        // H — настройки
        await page.keyboard.press('h');
        await page.waitForTimeout(300);
        await expect(page.locator('#settingsOverlay')).toHaveClass(/active/);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        // S — звук
        const soundBefore = await page.locator('#soundToggle').textContent();
        await page.keyboard.press('s');
        await page.waitForTimeout(200);
        const soundAfter = await page.locator('#soundToggle').textContent();
        expect(soundBefore).not.toBe(soundAfter);

        // Стрелка — игрок
        const p1Active = await page.locator('#cardP1').evaluate(el => el.classList.contains('active'));
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(300);
        const p2Active = await page.locator('#cardP2').evaluate(el => el.classList.contains('active'));
        expect(p1Active).not.toBe(p2Active);

        expect(errors.filter(e => !e.includes('AudioContext'))).toEqual([]);
    });

    test('TC4: Progress saves to localStorage', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(1500);
        const initial = await page.evaluate(() => localStorage.getItem('detGame_v23'));
        expect(initial).not.toBeNull();
    });
});