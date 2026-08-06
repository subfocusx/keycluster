const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const chromePath = 'C:\\Users\\admin\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromePath,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:1420/', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.screenshot({ path: 'E:\\Code\\TypeScript\\keycluster-tauri\\logs\\minus-words-screenshot.png', fullPage: false });
  console.log('Screenshot saved');
  await browser.close();
})();