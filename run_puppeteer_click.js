import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('Console:', msg.text()));
  page.on('pageerror', err => console.log('PageError:', err.message));
  await page.goto('http://localhost:3000');
  await new Promise(r => setTimeout(r, 1000));
  await page.type('input[type="text"]', 'admin');
  await page.type('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
