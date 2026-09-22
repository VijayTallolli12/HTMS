const { chromium } = require('playwright');

const BASE = 'http://localhost:4200';
const EMAIL = 'admin@tokyograndeur.demo';
const PASSWORD = 'Demo1234!';

let browser, context, page;
const results = {};

async function log(section, status, detail) {
  results[section] = { status, detail };
  console.log(`[${status}] ${section}: ${detail}`);
}

async function screenshot(name) {
  await page.screenshot({ path: `tests/browser/${name}.png`, fullPage: true });
  console.log(`  Screenshot: tests/browser/${name}.png`);
}

(async () => {
  const fs = require('fs');
  if (!fs.existsSync('tests/browser')) fs.mkdirSync('tests/browser', { recursive: true });

  browser = await chromium.launch({ headless: true });
  // Fresh context = no cookies, no localStorage
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();

  const consoleErrors = [];
  const networkErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));
  page.on('response', resp => {
    if (resp.status() >= 400) networkErrors.push(`${resp.status()} ${resp.url()}`);
  });

  try {
    // ============================================================
    // 1. LOGIN
    // ============================================================
    console.log('\n=== 1. LOGIN ===');
    // Clear any existing localStorage by going to the page first
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot('01-after-clear');
    console.log(`  URL after clear: ${page.url()}`);

    // Should redirect to /login now
    if (!page.url().includes('/login')) {
      console.log('  Not on login page, navigating manually...');
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000);
    }

    await screenshot('02-login-page');
    console.log(`  Login URL: ${page.url()}`);

    // Find and fill login form
    const emailInput = await page.$('input[type="email"], input#email');
    const passwordInput = await page.$('input[type="password"], input#password');

    if (emailInput && passwordInput) {
      await emailInput.fill(EMAIL);
      await passwordInput.fill(PASSWORD);
      await screenshot('03-credentials-filled');

      const submitBtn = await page.$('button[type="submit"]');
      if (submitBtn) {
        await submitBtn.click();
      } else {
        await page.keyboard.press('Enter');
      }

      // Wait for navigation (login + getProperties can take a while)
      try {
        await page.waitForURL('**/dashboard', { timeout: 30000 });
      } catch {
        await page.waitForTimeout(5000);
      }
      await page.waitForLoadState('networkidle').catch(() => {});
      await screenshot('04-after-login');
      console.log(`  Post-login URL: ${page.url()}`);

      if (page.url().includes('/dashboard')) {
        await log('A. Browser login', 'PASS', 'Login successful, redirected to dashboard');
      } else {
        await log('A. Browser login', 'WARN', `Post-login URL: ${page.url()}`);
      }
    } else {
      await screenshot('02-no-login-form');
      await log('A. Browser login', 'FAIL', 'Login form not found');
      const bodyText = await page.textContent('body');
      console.log(`  Page text: ${bodyText.substring(0, 500)}`);
    }

    // ============================================================
    // 2. CHECK ACTIVE PROPERTY
    // ============================================================
    console.log('\n=== 2. ACTIVE PROPERTY ===');
    await page.waitForTimeout(2000);
    const bodyText2 = await page.textContent('body');
    console.log(`  Body (first 400): ${bodyText2.substring(0, 400)}`);

    if (bodyText2.includes('Tokyo Grandeur')) {
      await log('B. Active property', 'PASS', 'Tokyo Grandeur Palace is active');
    } else if (bodyText2.includes('Portfolio Master') || bodyText2.includes('All Properties')) {
      await log('B. Active property', 'FAIL', 'Showing "Portfolio Master"');
    } else {
      await log('B. Active property', 'INFO', 'Property context unclear');
    }
    await screenshot('05-property-context');

    // ============================================================
    // 3. DASHBOARD
    // ============================================================
    console.log('\n=== 3. DASHBOARD ===');
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await screenshot('06-dashboard');
    const dashText = await page.textContent('body');

    if (dashText.includes('No active property')) {
      await log('C. Dashboard', 'FAIL', 'Shows "No active property selected"');
    } else {
      await log('C. Dashboard', 'PASS', `Dashboard loaded. Content: ${dashText.substring(0, 400)}`);
    }

    // ============================================================
    // 4. RESERVATIONS
    // ============================================================
    console.log('\n=== 4. RESERVATIONS ===');
    await page.goto(`${BASE}/pms/reservations`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await screenshot('07-reservations');
    const resText = await page.textContent('body');
    await log('D. Reservations', 'INFO', `Reservations: ${resText.substring(0, 400)}`);

    // ============================================================
    // 5. FRONT DESK
    // ============================================================
    console.log('\n=== 5. FRONT DESK ===');
    await page.goto(`${BASE}/pms/front-office`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await screenshot('08-front-desk');
    const fdText = await page.textContent('body');
    await log('E. Front Desk', 'INFO', `Front desk: ${fdText.substring(0, 400)}`);

    // ============================================================
    // 6. ROOM OPERATIONS
    // ============================================================
    console.log('\n=== 6. ROOM OPERATIONS ===');
    await page.goto(`${BASE}/pms/room-operations`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await screenshot('09-room-operations');
    const roText = await page.textContent('body');
    await log('F. Room Operations', 'INFO', `Room ops: ${roText.substring(0, 400)}`);

    // ============================================================
    // 7. HOUSEKEEPING
    // ============================================================
    console.log('\n=== 7. HOUSEKEEPING ===');
    await page.goto(`${BASE}/pms/housekeeping`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await screenshot('10-housekeeping');
    const hkText = await page.textContent('body');
    await log('H. Housekeeping', 'INFO', `Housekeeping: ${hkText.substring(0, 400)}`);

    // ============================================================
    // 8. NETWORK/CONSOLE ERRORS
    // ============================================================
    console.log('\n=== 8. ERRORS ===');
    const uniqueNetErrors = [...new Set(networkErrors)];
    if (uniqueNetErrors.length > 0) {
      await log('L. Network errors', 'WARN', uniqueNetErrors.slice(0, 10).join('\n  '));
    } else {
      await log('L. Network errors', 'PASS', 'No network errors');
    }
    if (consoleErrors.length > 0) {
      await log('M. Console errors', 'WARN', consoleErrors.slice(0, 5).join(' | '));
    } else {
      await log('M. Console errors', 'PASS', 'No console errors');
    }

    await screenshot('11-final-state');

  } catch (err) {
    console.error('FATAL ERROR:', err.message);
    await screenshot('error-state');
  } finally {
    console.log('\n========================================');
    console.log('BROWSER VERIFICATION SUMMARY');
    console.log('========================================');
    for (const [key, val] of Object.entries(results)) {
      console.log(`  ${val.status}: ${key} — ${val.detail}`);
    }
    console.log('========================================');
    if (browser) await browser.close();
  }
})();
