import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  await page.evaluateOnNewDocument(() => {
    const originalFetch = window.fetch;
    Object.defineProperty(window, 'fetch', {
      get: () => originalFetch,
      set: (val) => {
        console.error("SOMEONE TRIED TO SET FETCH!");
        console.error(new Error().stack);
      }
    });
  });

  page.on('console', msg => console.log('Console:', msg.text()));

  await page.goto('http://localhost:3000', {waitUntil: 'networkidle0'});
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
