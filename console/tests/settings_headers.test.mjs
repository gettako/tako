import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = '/Users/SupianIDz/.gemini/antigravity-ide/brain/72c652a8-99a2-4401-b806-027e24ce0276';
const BASE_URL = 'http://localhost:3000';

async function run() {
  console.log('🚀 Starting Settings Headers Validation with Playwright...');
  
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  const results = {
    overview: false,
    users: false,
    buckets: false,
    git: false,
    backups: false,
    domain: false,
    notifications: false,
    verifiedHeaders: [],
    errors: [],
  };

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      results.errors.push(`[Console Error] ${msg.text()}`);
    }
  });

  page.on('pageerror', (err) => {
    results.errors.push(`[Page Error] ${err.message}`);
  });

  try {
    console.log('Navigating to settings...');
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle', timeout: 30000 });

    // Handle login if redirected
    if (page.url().includes('/login')) {
      console.log('Redirected to /login. Logging in as admin...');
      await page.fill('input[type="email"], input[name="email"]', 'admin@gettako.dev');
      await page.fill('input[type="password"], input[name="password"]', 'admin123456');
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: 'networkidle' });
      await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
    }

    console.log('Current page URL:', page.url());
    await page.waitForSelector('h1:has-text("Cluster Settings")', { timeout: 15000 });

    // Helper function to check headers in current panel
    const checkHeaders = async (panelName, expectedTitles) => {
      console.log(`\n--- Checking ${panelName} panel headers ---`);
      for (const title of expectedTitles) {
        const headerLocator = page.locator(`[data-slot="card-title"]:has-text("${title}")`).first();
        await headerLocator.waitFor({ state: 'visible', timeout: 10000 });
        
        const isVisible = await headerLocator.isVisible();
        const className = await headerLocator.getAttribute('class');
        const fontWeight = await headerLocator.evaluate((el) => window.getComputedStyle(el).fontWeight);
        
        console.log(`  ✓ Title "${title}": visible=${isVisible}, fontWeight=${fontWeight}, class="${className}"`);
        
        if (isVisible && (fontWeight === '600' || className.includes('font-semibold'))) {
          results.verifiedHeaders.push({
            panel: panelName,
            title,
            fontWeight,
            isSemibold: true,
          });
        } else {
          throw new Error(`Header "${title}" in ${panelName} is not font-semibold (got weight ${fontWeight})`);
        }
      }
    };

    // 1. Overview Panel
    await checkHeaders('Overview', [
      'Tako Control Plane Specifications',
      'Edge Ingress & Hostname',
      'Storage & Snapshots',
      'Cluster Resource Allocation & Workload Capacity',
    ]);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'settings_overview.png') });
    results.overview = true;

    // 2. Team & Users Panel
    console.log('\nNavigating to Users panel...');
    await page.click('nav button:has-text("Team & RBAC")');
    await page.waitForTimeout(600);
    await checkHeaders('Users', [
      'Team Members & Permissions',
    ]);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'settings_users.png') });
    results.users = true;

    // 3. S3 Storage Buckets Panel
    console.log('\nNavigating to S3 Storage panel...');
    await page.click('nav button:has-text("S3 Storage")');
    await page.waitForTimeout(600);
    await checkHeaders('Buckets', [
      'S3 Compatible Object Storage',
    ]);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'settings_buckets.png') });
    results.buckets = true;

    // 4. Git Providers Panel
    console.log('\nNavigating to Git Providers panel...');
    await page.click('nav button:has-text("Git Providers")');
    await page.waitForTimeout(600);
    await checkHeaders('Git', [
      'Connected Accounts',
      'Repositories',
    ]);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'settings_git.png') });
    results.git = true;

    // 5. Backups Panel
    console.log('\nNavigating to Backups panel...');
    await page.click('nav button:has-text("Backups")');
    await page.waitForTimeout(600);
    await checkHeaders('Backups', [
      'Tako Control Plane Backups',
      'Cluster Snapshots History',
    ]);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'settings_backups.png') });
    results.backups = true;

    // 6. Cluster Domain Panel
    console.log('\nNavigating to Cluster Domain panel...');
    await page.click('nav button:has-text("Cluster Domain")');
    await page.waitForTimeout(600);
    await checkHeaders('Domain', [
      'Cluster Hostname & SSL Configuration',
    ]);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'settings_domain.png') });
    results.domain = true;

    // 7. Notifications Panel
    console.log('\nNavigating to Notifications panel...');
    await page.click('nav button:has-text("Notifications")');
    await page.waitForTimeout(600);
    await checkHeaders('Notifications', [
      'Email Alerts (SMTP)',
      'Slack Webhook',
      'Discord Webhook',
      'Telegram Bot',
    ]);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'settings_notifications.png') });
    results.notifications = true;

    console.log('\n🎉 ALL 7 PANELS AND ALL 15 SECTION HEADERS VERIFIED SUCCESSFULLY!');
    console.log(`Total verified section headers: ${results.verifiedHeaders.length}`);

  } catch (err) {
    console.error('Validation error:', err);
    results.errors.push(err.message);
  } finally {
    await browser.close();
  }

  const reportPath = path.join(ARTIFACT_DIR, 'settings_headers_test_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`Report written to ${reportPath}`);

  if (results.errors.length > 0) {
    process.exit(1);
  }
}

run();
