const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { loadEnvConfig } = require('@next/env');

// Next.js normalizes loopback IPs to localhost on middleware redirects.
const origin = 'http://localhost:3000';
const phone = process.env.KIRIN_TEST_PHONE;
const sizes = [[320, 568], [390, 844], [667, 375], [768, 1024], [1366, 768]];

async function checkLayout(page, selector) {
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    const bounds = await page.locator(selector).evaluateAll(elements => elements
      .filter(el => el.getClientRects().length)
      .map(el => {
        const rect = el.getBoundingClientRect();
        return { left: rect.left, right: rect.right, name: el.id || el.textContent?.trim().slice(0, 30) };
      }));
    assert.ok(bounds.length > 0);
    for (const { left, right, name } of bounds) {
      assert.ok(left >= -1 && right <= width + 1, `${name} overflows at ${width}px`);
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Page overflows at ${width}px`);
  }
}

test('an interrupted OTP signup resumes at the display name', async t => {
  const browser = await chromium.launch({ executablePath: chromium.executablePath() });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.context().route('**/api/auth/send-otp', route => route.fulfill({ json: { data: { requestId: 'test' } } }));
  await page.context().route('**/api/auth/verify-otp', route => route.fulfill({
    json: { data: { isNewUser: false, isAdmin: false, name: null } },
  }));
  await page.goto(origin + '/auth');
  await page.locator('#auth-otp-phone').fill('9000000000');
  await page.getByRole('button', { name: 'Send OTP' }).click();
  for (let i = 1; i <= 6; i++) await page.getByLabel('Verification code digit ' + i).fill('0');
  await page.getByPlaceholder('Your name').waitFor();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByText('Enter your name.', { exact: true }).waitFor();
});

test('driver sign-in, navigation and booking selections across screen sizes', { timeout: 240000 }, async t => {
  const env = loadEnvConfig(process.cwd(), true).combinedEnv;
  assert.match(phone ?? '', /^[6-9]\d{9}$/, 'Set KIRIN_TEST_PHONE to a kirin-dev OTP driver');
  assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname, 'mqlzsxwntsnhwfxbyyaq.supabase.co');
  assert.equal(env.OTP_BYPASS, 'true', 'Run against the local mock OTP configuration');
  const browser = await chromium.launch({ executablePath: chromium.executablePath() });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 320, height: 568 }, timezoneId: 'Asia/Kolkata', serviceWorkers: 'allow' });
  const errors = [];
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/activity');
  await page.waitForURL('**/auth**');
  await page.getByRole('button', { name: 'Send OTP' }).click();
  await page.getByText('Enter your phone number.', { exact: true }).waitFor();
  await checkLayout(page, 'main input, main button');
  await page.getByRole('link', { name: 'Privacy Policy' }).click();
  await page.locator('#privacy').waitFor();
  await page.goBack();
  await page.getByRole('button', { name: 'Use username and PIN' }).click();
  await page.getByRole('button', { name: /Create an account/ }).click();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  assert.equal(await page.locator('input[aria-invalid="true"]').count(), 3);
  await checkLayout(page, 'main input, main button');
  await page.goto(origin + '/auth');
  await page.locator('#auth-otp-phone').fill(phone);
  await page.getByRole('button', { name: 'Send OTP' }).click();
  await page.getByLabel('Verification code digit 1').waitFor();
  await checkLayout(page, 'main input, main button');
  const verified = page.waitForResponse(res => res.url().endsWith('/api/auth/verify-otp'));
  for (let digit = 1; digit <= 6; digit++) await page.getByLabel('Verification code digit ' + digit).fill('0');
  const response = await verified;
  const result = await response.json();
  assert.equal(response.status(), 200, result.error);
  if (result.data.isNewUser || !result.data.name) {
    await page.getByPlaceholder('Your name').fill(process.env.KIRIN_TEST_NAME || 'Journey Driver');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  }
  await page.waitForURL('**/home', { timeout: 35000 });
  for (const route of ['home', 'explore', 'activity', 'profile']) {
    if (route !== 'home') await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: new RegExp(route, 'i') }).click();
    await page.waitForURL('**/' + route);
    await page.locator('nav a[aria-current="page"]:visible').first().waitFor();
    await checkLayout(page, 'nav[aria-label="Main navigation"] a');
    if (route === 'explore') {
      const filters = page.getByRole('dialog', { name: 'Filters', exact: true });
      await page.getByRole('button', { name: /^Filters/ }).click();
      await filters.waitFor();
      await checkLayout(page, '[role="dialog"][aria-label="Filters"] button');
      await filters.getByRole('button', { name: 'Apply' }).click();
      await filters.waitFor({ state: 'hidden' });
    }
    if (route === 'activity') {
      await page.getByRole('button', { name: /^Updates/ }).click();
      await page.getByRole('button', { name: 'Sessions', exact: true }).click();
      await page.getByRole('button', { name: /^All/ }).click();
      const filters = page.getByRole('dialog', { name: 'Filter sessions' });
      await checkLayout(page, '[role="dialog"][aria-label="Filter sessions"] button');
      await filters.getByRole('button', { name: /^Completed/ }).click();
      await filters.waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: 'Completed', exact: true }).waitFor();
    }
  }

  await page.getByRole('link', { name: /My Vehicles/i }).click();
  await page.waitForURL('**/profile/vehicles');
  await page.goto(origin + '/hosting/learn');
  await page.getByRole('heading', { name: /Share your charger/ }).waitFor();
  await checkLayout(page, 'main h1, main button');
  await page.goto(origin + '/admin/kyc');
  await page.waitForURL('**/explore?error=admin_required');

  // Keep boundary cases repeatable with a synthetic charger and availability window.
  // A payment request is a test failure even if someone adds an automatic checkout.
  let paymentRequests = 0;
  await page.context().route('**/api/payments/**', route => { paymentRequests++; return route.abort(); });
  const charger = { id: 'test-charger', lender_id: 'test-host', title: 'Journey charger',
    status: 'active', charger_type: 'AC_7kW', price_per_kwh: 12, connector_types: ['Type2'] };
  await page.context().route('**/api/chargers/test-charger', route => route.fulfill({ json: { data: charger } }));
  let failAvailability = false;
  await page.context().route('**/api/chargers/test-charger/availability-window?*', route => {
    if (failAvailability) return route.fulfill({ status: 503, json: { error: 'Unavailable' } });
    const start = new Date(new URL(route.request().url()).searchParams.get('start'));
    return route.fulfill({ json: { data: { max_end: new Date(+start + 30 * 60000).toISOString(), reason: 'Next booking' } } });
  });

  await page.context().route('**/api/chargers/paused-charger', route =>
    route.fulfill({ json: { data: { ...charger, id: 'paused-charger', status: 'paused' } } }));
  await page.goto(origin + '/bookings/new?charger=paused-charger');
  await page.getByRole('heading', { name: 'This charger is unavailable' }).waitFor();
  await page.getByRole('link', { name: 'Find another charger' }).waitFor();
  assert.equal(await page.getByRole('button', { name: /Pay.*book/ }).count(), 0);

  const midnight = await page.evaluate(() => { const d = new Date(); d.setHours(0, 2, 0, 0); return +d; });
  await page.clock.setFixedTime(new Date(midnight));
  await page.goto(origin + '/bookings/new?charger=test-charger');
  const pay = page.getByRole('button', { name: /Pay.*book/ });
  const date = page.getByLabel('Date', { exact: true });
  const originalDate = await date.inputValue();
  assert.equal(originalDate, new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(midnight));
  await page.getByText('Next booking', { exact: true }).waitFor();
  assert.ok(await pay.isDisabled(), '60-minute selection must not fit a 30-minute window');
  await page.getByRole('button', { name: '30 min', exact: true }).click();
  assert.ok(await pay.isEnabled());
  await page.getByRole('button', { name: 'Custom', exact: true }).click();
  await page.getByLabel('Hours', { exact: true }).fill('0');
  await page.getByLabel('Minutes', { exact: true }).fill('29');
  assert.ok(await pay.isDisabled());
  await page.getByLabel('Minutes', { exact: true }).fill('30');
  assert.ok(await pay.isEnabled());
  await checkLayout(page, 'main input, main button');
  await date.fill('');
  await page.getByText('Choose a date and start time.').waitFor();
  assert.ok(await pay.isDisabled());
  failAvailability = true;
  await date.fill(originalDate);
  await page.getByRole('button', { name: 'Try again' }).waitFor();
  assert.ok(await pay.isDisabled());
  failAvailability = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('& book') && !b.disabled));
  await page.getByRole('button', { name: 'By budget' }).click();
  await page.getByRole('button', { name: 'Custom amount' }).click();
  const budget = page.getByLabel('Budget limit');
  for (const invalid of ['', '0', '-10', '1.5']) {
    await budget.fill(invalid);
    assert.ok(await pay.isDisabled());
    await page.getByText('Enter a positive whole-rupee amount.').waitFor();
  }
  await budget.fill('1');
  await page.getByText(/Budget too low/).waitFor();
  assert.ok(await pay.isDisabled());
  await budget.fill('100');
  assert.equal(await pay.innerText(), 'Pay ₹42 & book');
  assert.ok(await pay.isEnabled());
  await page.setViewportSize({ width: 320, height: 568 });
  await pay.click({ trial: true });
  assert.equal(paymentRequests, 0);
  assert.deepEqual(errors, []);
});
