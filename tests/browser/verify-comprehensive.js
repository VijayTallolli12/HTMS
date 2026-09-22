const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const netErrors = [];
  page.on('response', r => { if (r.status() >= 400) netErrors.push(r.status() + ' ' + r.url()); });
  
  await page.goto('http://localhost:4200', { waitUntil: 'networkidle', timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.goto('http://localhost:4200/login', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', 'admin@tokyograndeur.demo');
  await page.fill('input[type="password"]', 'Demo1234!');
  await page.click('button[type="submit"]');
  try { await page.waitForURL('**/dashboard', { timeout: 30000 }); } catch(e) {}
  await page.waitForLoadState('networkidle').catch(()=>{});
  console.log('Post-login URL:', page.url());

  const pages = [
    ['/pms/availability', 'Availability'],
    ['/pms/folios', 'Folio'],
    ['/organization', 'Organization'],
    ['/pms/housekeeping', 'Housekeeping'],
  ];

  for (const [path, name] of pages) {
    console.log('\n=== ' + path + ' ===');
    await page.goto('http://localhost:4200' + path, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    const text = await page.textContent('body');
    const hasProperty = text.includes('Tokyo Grandeur Palace');
    const hasContent = text.length > 100;
    const onCorrectPage = !page.url().includes('/login');
    console.log('  URL:', page.url());
    console.log('  Has Tokyo Grandeur:', hasProperty);
    console.log('  Has content:', hasContent, '(' + text.length + ' chars)');
    console.log('  On correct page:', onCorrectPage);
    console.log('  First 300:', text.substring(0, 300));
    await page.screenshot({ path: 'tests/browser/verify-' + name.toLowerCase() + '.png', fullPage: true });
  }

  const uniqueNet = [...new Set(netErrors)];
  console.log('\nNetwork errors:', uniqueNet.length === 0 ? 'NONE' : uniqueNet.join('\n  '));
  await browser.close();
})();
