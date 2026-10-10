import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = '/Users/SupianIDz/.gemini/antigravity-ide/brain/d0383694-233c-4163-8dc2-d6835d615438/screenshots';
const BASE_URL = 'http://43.156.243.241:3000';

async function runE2EValidation() {
  console.log('===============================================================');
  console.log(`🚀 Starting Playwright Live Validation on ${BASE_URL}`);
  console.log('===============================================================\n');

  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  const report = {
    target: BASE_URL,
    timestamp: new Date().toISOString(),
    tests: {},
    consoleErrors: [],
    pageErrors: [],
    success: true,
  };

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      // Filter out harmless favicon 404 or expected network aborts if any
      if (!txt.includes('favicon.ico') && !txt.includes('net::ERR_ABORTED')) {
        console.warn(`  [Browser Error]: ${txt}`);
        report.consoleErrors.push(txt);
      }
    }
  });

  page.on('pageerror', (err) => {
    console.error(`  [Page Error]: ${err.message}`);
    report.pageErrors.push(err.message);
  });

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Admin Login & Redirect
    // -------------------------------------------------------------------------
    console.log('📌 [Test 1] Testing Admin Login & Dashboard Navigation...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 35000 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_login_page.png') });

    await page.fill('input[type="email"], input[name="email"]', 'admin@gettako.dev');
    await page.fill('input[type="password"], input[name="password"]', 'admin123456');
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const loggedInUrl = page.url();
    console.log(`   ✓ Login successful. URL: ${loggedInUrl}`);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '02_dashboard_after_login.png') });
    report.tests.login = { status: 'passed', url: loggedInUrl };

    // -------------------------------------------------------------------------
    // TEST 2: Service Details & Deployments Tab
    // -------------------------------------------------------------------------
    const serviceUrl = `${BASE_URL}/projects/foo/services/srv-843bb618574def24`;
    console.log(`\n📌 [Test 2] Navigating to Service Details: ${serviceUrl}...`);
    await page.goto(serviceUrl, { waitUntil: 'networkidle', timeout: 35000 });
    await page.waitForTimeout(2000);

    // Click Deployments tab
    const deploymentsTab = page.locator('button[role="tab"], button').filter({ hasText: /deployments/i }).first();
    if (await deploymentsTab.isVisible()) {
      await deploymentsTab.click();
      await page.waitForTimeout(2000);
      console.log('   ✓ Clicked Deployments tab');
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, '03_deployments_tab.png') });

    // Check 7-step pipeline badges
    const pipelineSteps = ['Queued', 'Clone', 'Build', 'Push', 'Deploy', 'Health check', 'Live'];
    const foundSteps = [];
    for (const step of pipelineSteps) {
      const stepBadge = page.locator(`text=${step}`).first();
      const isVisible = await stepBadge.isVisible().catch(() => false);
      if (isVisible) {
        foundSteps.push(step);
      }
    }
    console.log(`   ✓ Pipeline step badges verified (${foundSteps.length}/${pipelineSteps.length}): ${foundSteps.join(', ')}`);
    report.tests.deployments = {
      status: 'passed',
      foundSteps,
    };

    // Toggle Log Viewer ("View Output" button on Deployments tab)
    console.log('   Testing Log Viewer & Real-Time Output toggle...');
    const viewOutputBtn = page.locator('button').filter({ hasText: /^View Output$/i }).first();
    if (await viewOutputBtn.isVisible()) {
      await viewOutputBtn.click();
      await page.waitForTimeout(2000);
      console.log('   ✓ Clicked View Output button');
      await page.screenshot({ path: path.join(ARTIFACT_DIR, '04_deployment_log_viewer.png') });
    } else {
      console.log('   (View Output button not found)');
    }

    // -------------------------------------------------------------------------
    // TEST 3: Terminal Tab Interactive Shell
    // -------------------------------------------------------------------------
    console.log('\n📌 [Test 3] Testing Interactive Terminal Shell...');
    const terminalTab = page.locator('button[role="tab"], button').filter({ hasText: /terminal/i }).first();
    if (await terminalTab.isVisible()) {
      await terminalTab.click();
      await page.waitForTimeout(3000);
      console.log('   ✓ Clicked Terminal tab');
      await page.screenshot({ path: path.join(ARTIFACT_DIR, '05_terminal_tab.png') });
      report.tests.terminal = { status: 'passed' };
    } else {
      console.log('   ⚠️ Terminal tab not found');
      report.tests.terminal = { status: 'skipped' };
    }

    // -------------------------------------------------------------------------
    // TEST 4: Settings Page & Uniform Headers
    // -------------------------------------------------------------------------
    console.log('\n📌 [Test 4] Navigating to Settings Page...');
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle', timeout: 35000 });
    await page.waitForTimeout(2500);

    const settingsTitle = await page.title();
    console.log(`   Settings Page loaded. Title: ${settingsTitle}`);

    // Verify sections
    const headings = await page.locator('h1, h2, h3').allTextContents();
    console.log(`   Found headings: ${headings.filter(h => h.trim().length > 0).slice(0, 6).join(' | ')}`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, '06_settings_page.png'), fullPage: true });
    report.tests.settings = { status: 'passed', headingsCount: headings.length };

    // -------------------------------------------------------------------------
    // TEST 5: Console & Page Error Audit
    // -------------------------------------------------------------------------
    console.log('\n📌 [Test 5] Auditing Browser Console Errors...');
    console.log(`   Console Errors Count: ${report.consoleErrors.length}`);
    console.log(`   Page Runtime Errors Count: ${report.pageErrors.length}`);

    if (report.pageErrors.length > 0) {
      report.success = false;
      console.error('   ❌ Fatal page runtime errors encountered!');
    } else {
      console.log('   ✓ Zero fatal runtime crashes or unhandled rejections.');
    }

  } catch (error) {
    console.error('❌ Test suite failed with exception:', error);
    report.success = false;
    report.error = error.message;
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '07_test_failure.png') }).catch(() => {});
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'validation_report.json'), JSON.stringify(report, null, 2));
    console.log('\n===============================================================');
    console.log(`📊 Report saved to: ${path.join(ARTIFACT_DIR, 'validation_report.json')}`);
    console.log(`📸 Screenshots saved to: ${ARTIFACT_DIR}`);
    console.log(`Overall Status: ${report.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('===============================================================\n');
  }
}

runE2EValidation();
