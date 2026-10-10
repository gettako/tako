import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = '/Users/SupianIDz/.gemini/antigravity-ide/brain/72c652a8-99a2-4401-b806-027e24ce0276';
const REMOTE_URL = 'http://43.156.243.241:3000';

async function testRemote() {
  console.log(`🌐 Connecting to remote console at ${REMOTE_URL}...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  page.on('console', (msg) => console.log(`[Browser Console ${msg.type()}]:`, msg.text()));
  page.on('pageerror', (err) => console.error('[Browser PageError]:', err.message));

  try {
    await page.goto(`${REMOTE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Opened login page, URL:', page.url());
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'remote_login_page.png') });

    // Fill in credentials
    console.log('Attempting login with admin@gettako.dev...');
    await page.fill('input[type="email"], input[name="email"]', 'admin@gettako.dev');
    await page.fill('input[type="password"], input[name="password"]', 'admin123456');
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(e => console.log('Navigation wait timeout or inline state change'));
    await page.waitForTimeout(3000);

    console.log('Current URL after login attempt:', page.url());
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'remote_after_login.png') });

    // Check where we are
    const title = await page.title();
    console.log('Page Title:', title);

  } catch (error) {
    console.error('Error during test:', error);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'remote_error.png') }).catch(() => {});
  } finally {
    await browser.close();
  }
}

testRemote();
