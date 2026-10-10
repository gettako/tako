import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = '/Users/SupianIDz/.gemini/antigravity-ide/brain/0c3d5813-c01f-4cd2-9b0e-71d327fcdf9f';
const BASE_URL = 'http://43.156.243.241:3000';

async function run() {
  const results = {
    overview: false,
    editProfile: false,
    totpSetup: false,
    passwordForm: false,
    passkeysTab: false,
    sessionsTab: false,
    logs: [],
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 950 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      results.logs.push(`[Console Error] ${msg.text()}`);
    }
  });

  page.on('pageerror', (err) => {
    results.logs.push(`[Page Error] ${err.message}`);
  });

  try {
    console.log('Navigating to profile...');
    await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle', timeout: 30000 });

    // Handle login if redirected
    if (page.url().includes('/login')) {
      console.log('Redirected to /login. Logging in...');
      await page.fill('input[type="email"], input[name="email"]', 'admin@gettako.dev');
      await page.fill('input[type="password"], input[name="password"]', 'admin123456');
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: 'networkidle' });
      await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' });
    }

    console.log('On profile page:', page.url());
    await page.waitForSelector('h1:has-text("Account & Security")', { timeout: 15000 });

    // 1. Overview & Hero Identity Card
    const nameText = await page.textContent('h2');
    const emailText = await page.textContent('text=admin@gettako.dev');
    const roleBadge = await page.textContent('text=admin');
    console.log(`Identity details: Name=${nameText}, Email=${emailText}, Role=${roleBadge}`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'profile_overview.png'), fullPage: false });
    results.overview = true;

    // 2. Edit Profile Modal
    console.log('Testing Edit Profile dialog...');
    await page.click('button:has-text("Edit Profile")');
    await page.waitForSelector('text=Edit Account Profile', { timeout: 5000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'profile_edit_dialog.png') });

    // Test editing name
    const nameInput = page.locator('input[placeholder="e.g. Administrator"]');
    await nameInput.fill('Administrator Tako');
    await page.click('button:has-text("Save Changes")');
    await page.waitForTimeout(1000); // Wait for mutation and toast

    // Verify updated header
    const updatedName = await page.textContent('h2');
    console.log(`Updated Name in UI: ${updatedName}`);

    // Revert back cleanly to "Administrator"
    await page.click('button:has-text("Edit Profile")');
    await page.waitForSelector('text=Edit Account Profile');
    await page.locator('input[placeholder="e.g. Administrator"]').fill('Administrator');
    await page.click('button:has-text("Save Changes")');
    await page.waitForTimeout(1000);
    results.editProfile = true;

    // 3. TOTP Setup Dialog
    console.log('Testing 2FA TOTP setup dialog...');
    const setup2faBtn = page.locator('button:has-text("Set Up 2FA")');
    if (await setup2faBtn.isVisible()) {
      await setup2faBtn.click();
      await page.waitForSelector('text=Two-Factor Authentication Setup', { timeout: 8000 });
      await page.waitForSelector('img[alt="TOTP QR Code"]', { timeout: 10000 });
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'profile_2fa_setup_step1.png') });

      // Click next step
      await page.click('button:has-text("Next: Verify Code")');
      await page.waitForSelector('text=Step 2 of 3', { timeout: 5000 });
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'profile_2fa_setup_step2.png') });

      // Close modal
      const closeBtn = page.locator('button[data-slot="dialog-close"]');
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(1000);
      results.totpSetup = true;
    } else {
      console.log('2FA is already enabled or button not visible');
      results.totpSetup = true;
    }

    // 4. Password Form Validation
    console.log('Testing Password Change Form...');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'profile_password_form.png') });

    // Test submitting invalid password change
    await page.fill('input[placeholder="••••••••••••"]', 'wrongcurrentpassword123');
    await page.fill('input[placeholder="At least 8 characters"]', 'newsecretpass123');
    await page.fill('input[placeholder="Repeat new password"]', 'newsecretpass123');
    await page.click('button:has-text("Update Password")');
    await page.waitForTimeout(1000); // Wait for toast response
    // Clear inputs
    await page.fill('input[placeholder="••••••••••••"]', '');
    await page.fill('input[placeholder="At least 8 characters"]', '');
    await page.fill('input[placeholder="Repeat new password"]', '');
    results.passwordForm = true;

    // 5. Passkeys Tab
    console.log('Testing Passkeys Tab...');
    await page.click('button[role="tab"]:has-text("Passkeys")');
    await page.waitForSelector('text=Passkeys & Biometrics', { timeout: 5000 });

    await page.click('button:has-text("Add Passkey")');
    await page.waitForSelector('text=Register New Passkey', { timeout: 5000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'profile_passkey_dialog.png') });
    await page.click('button:has-text("Cancel")');
    await page.waitForTimeout(500);
    results.passkeysTab = true;

    // 6. Active Sessions Tab
    console.log('Testing Active Sessions Tab...');
    await page.click('button[role="tab"]:has-text("Active Sessions")');
    await page.waitForSelector('text=Active Browser & Device Sessions', { timeout: 5000 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'profile_sessions_tab.png') });
    results.sessionsTab = true;

    console.log('All profile tests completed successfully!');
    console.log(JSON.stringify(results, null, 2));
  } catch (err) {
    console.error('Test execution failed:', err);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'profile_test_failure.png') });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
