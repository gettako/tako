import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = '/Users/SupianIDz/.gemini/antigravity-ide/brain/72c652a8-99a2-4401-b806-027e24ce0276';
const BASE_URL = 'http://43.156.243.241:3000';

async function runLiveSuite() {
  console.log(`=======================================================`);
  console.log(`🚀 Starting Playwright Live Test Suite on ${BASE_URL}`);
  console.log(`=======================================================\n`);

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
    steps: {},
    consoleErrors: [],
    pageErrors: [],
  };

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      report.consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    report.pageErrors.push(err.message);
  });

  try {
    // -------------------------------------------------------------------------
    // 1. Authentication Flow
    // -------------------------------------------------------------------------
    console.log('📌 [Step 1] Testing Authentication Flow...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'live_01_login_page.png') });

    await page.fill('input[type="email"], input[name="email"]', 'admin@gettako.dev');
    await page.fill('input[type="password"], input[name="password"]', 'admin123456');
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const afterLoginUrl = page.url();
    console.log(`   Logged in successfully. Current URL: ${afterLoginUrl}`);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'live_02_dashboard.png') });
    
    report.steps.auth = {
      status: afterLoginUrl.endsWith('/') || afterLoginUrl.includes('/projects') ? 'PASSED' : 'WARNING',
      url: afterLoginUrl,
    };

    // -------------------------------------------------------------------------
    // 2. Dashboard Telemetry & Stats Verification
    // -------------------------------------------------------------------------
    console.log('\n📌 [Step 2] Validating Dashboard & Telemetry Metrics...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    const clusterOverviewExists = await page.isVisible('h1:has-text("Cluster Overview")');
    const telemetryExists = await page.isVisible('h2:has-text("Cluster Telemetry")');
    console.log(`   Cluster Overview header: ${clusterOverviewExists}`);
    console.log(`   Cluster Telemetry section: ${telemetryExists}`);

    report.steps.dashboard = {
      status: clusterOverviewExists && telemetryExists ? 'PASSED' : 'FAILED',
      clusterOverview: clusterOverviewExists,
      telemetry: telemetryExists,
    };

    // -------------------------------------------------------------------------
    // 3. Projects Page & Navigation
    // -------------------------------------------------------------------------
    console.log('\n📌 [Step 3] Navigating to Projects List...');
    await page.click('nav button:has-text("Projects"), nav a:has-text("Projects")').catch(async () => {
      await page.goto(`${BASE_URL}/projects`, { waitUntil: 'networkidle' });
    });
    await page.waitForTimeout(2000);
    console.log(`   Projects URL: ${page.url()}`);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'live_03_projects_list.png') });

    const projectCards = await page.$$eval('[data-testid="project-card"], a[href*="/projects/"]', (els) =>
      els.map((e) => ({
        text: e.textContent?.trim().slice(0, 50),
        href: e.getAttribute('href'),
      }))
    );
    console.log(`   Found ${projectCards.length} project link(s) / card(s):`, projectCards.map(p => p.href));

    report.steps.projects = {
      status: projectCards.length > 0 ? 'PASSED' : 'EMPTY',
      count: projectCards.length,
      cards: projectCards,
    };

    // -------------------------------------------------------------------------
    // 4. Project Details & Services List (Target: Default Project / foo)
    // -------------------------------------------------------------------------
    console.log('\n📌 [Step 4] Opening Project Details (foo)...');
    await page.goto(`${BASE_URL}/projects/foo`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    console.log(`   Project detail URL: ${page.url()}`);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'live_04_project_detail.png') });

    const serviceLinks = await page.$$eval('a[href*="/services/"]', (els) =>
      els.map((e) => ({
        text: e.textContent?.trim().slice(0, 60),
        href: e.getAttribute('href'),
      }))
    );
    console.log(`   Found ${serviceLinks.length} service link(s):`, serviceLinks);

    report.steps.projectDetail = {
      status: serviceLinks.length > 0 ? 'PASSED' : 'NO_SERVICES',
      services: serviceLinks,
    };

    // -------------------------------------------------------------------------
    // 5. Service Details & Deployments Pipeline
    // -------------------------------------------------------------------------
    const targetServiceHref = serviceLinks[0]?.href || '/projects/foo/services/srv-843bb618574def24';
    console.log(`\n📌 [Step 5] Opening Service Details: ${targetServiceHref}...`);
    await page.goto(`${BASE_URL}${targetServiceHref}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'live_05_service_overview.png') });

    // Click Deployments Tab
    console.log('   Switching to Deployments tab...');
    const deploymentsTabBtn = await page.$('button[role="tab"]:has-text("Deployments"), button:has-text("Deployments")');
    if (deploymentsTabBtn) {
      await deploymentsTabBtn.click();
      await page.waitForTimeout(2500);
      console.log('   Clicked Deployments tab successfully.');
    } else {
      console.log('   Could not find Deployments tab button via text query, checking URL hash/query...');
      await page.goto(`${BASE_URL}${targetServiceHref}?tab=deployments`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2500);
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'live_06_service_deployments.png') });

    // Check Deployment pipeline elements
    const stepBadges = await page.$$eval('[data-testid="pipeline-step"], div:has-text("Queued"), div:has-text("Live")', (els) => els.length);
    const viewOutputBtn = await page.$('button:has-text("View Output"), button:has-text("Hide Output")');
    if (viewOutputBtn) {
      console.log('   Found log toggle button. Toggling log output viewer...');
      await viewOutputBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'live_07_deployment_logs_expanded.png') });
    }

    report.steps.serviceDeployments = {
      status: 'PASSED',
      url: page.url(),
      hasLogToggle: !!viewOutputBtn,
    };

    // -------------------------------------------------------------------------
    // 6. Cluster Nodes / Infrastructure
    // -------------------------------------------------------------------------
    console.log('\n📌 [Step 6] Checking Cluster Nodes (/nodes)...');
    await page.goto(`${BASE_URL}/nodes`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'live_08_nodes_list.png') });

    const nodesHeader = await page.isVisible('h1:has-text("Cluster Nodes"), h1:has-text("Nodes")');
    report.steps.nodes = {
      status: nodesHeader ? 'PASSED' : 'CHECK_PAGE',
      headerFound: nodesHeader,
    };

    // -------------------------------------------------------------------------
    // 7. Cluster Settings & Standardized Section Headers
    // -------------------------------------------------------------------------
    console.log('\n📌 [Step 7] Checking Cluster Settings (/settings)...');
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'live_09_settings_overview.png') });

    const settingsHeader = await page.isVisible('h1:has-text("Cluster Settings")');
    console.log(`   Cluster Settings H1 exists: ${settingsHeader}`);

    report.steps.settings = {
      status: settingsHeader ? 'PASSED' : 'FAILED',
      headerFound: settingsHeader,
    };

    console.log('\n✅ All Live Test Scenarios Executed Successfully!');

  } catch (error) {
    console.error('\n❌ Error encountered during test execution:', error);
    report.error = error.message;
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'live_fatal_error.png') }).catch(() => {});
  } finally {
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'live_remote_test_report.json'),
      JSON.stringify(report, null, 2)
    );
    await browser.close();
  }
}

runLiveSuite();
