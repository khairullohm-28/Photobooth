import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('--- 1. Navigating to /admin/login ---');
  await page.goto('http://localhost:3000/admin/login');
  await page.waitForLoadState('networkidle');

  // Check if we need to login
  const isLoginPage = await page.locator('text=Masuk Admin').count() > 0;
  if (isLoginPage) {
    console.log('Logging in as owner...');
    await page.fill('input[type="text"], input[name="username"]', 'owner');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("Masuk")');
    await page.waitForLoadState('networkidle');
  }

  console.log('Logged in! Current URL:', page.url());

  // Set desktop viewport
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(500);

  console.log('\n--- Test 1: Accordion Single-Open & Parent Menu Click ---');
  // Click 'Booking' parent menu
  console.log('Clicking "Booking"...');
  await page.click('[data-testid="menu-parent-booking"]');
  await page.waitForTimeout(300);
  console.log('Current URL after clicking Booking:', page.url());
  const bookingSubVisible = await page.locator('[data-testid="submenu-container-booking"]').isVisible();
  console.log('Booking submenu visible:', bookingSubVisible);

  // Click 'Studio Foto' parent menu
  console.log('Clicking "Studio Foto"...');
  await page.click('[data-testid="menu-parent-studio"]');
  await page.waitForTimeout(300);
  console.log('Current URL after clicking Studio Foto:', page.url());
  const studioSubVisible = await page.locator('[data-testid="submenu-container-studio"]').isVisible();
  const bookingSubClosed = !(await page.locator('[data-testid="submenu-container-booking"]').isVisible());
  console.log('Studio Foto submenu visible:', studioSubVisible, '| Booking closed:', bookingSubClosed);

  // Click 'Setting' parent menu
  console.log('Clicking "Setting"...');
  await page.click('[data-testid="menu-parent-settings"]');
  await page.waitForTimeout(300);
  console.log('Current URL after clicking Setting:', page.url());
  const settingsSubVisible = await page.locator('[data-testid="submenu-container-settings"]').isVisible();
  const studioSubClosed = !(await page.locator('[data-testid="submenu-container-studio"]').isVisible());
  console.log('Setting submenu visible:', settingsSubVisible, '| Studio closed:', studioSubClosed);

  // Click 'Laporan' parent menu
  console.log('Clicking "Laporan"...');
  await page.click('[data-testid="menu-parent-reports"]');
  await page.waitForTimeout(300);
  console.log('Current URL after clicking Laporan:', page.url());
  const reportsSubVisible = await page.locator('[data-testid="submenu-container-reports"]').isVisible();
  const settingsSubClosed = !(await page.locator('[data-testid="submenu-container-settings"]').isVisible());
  console.log('Laporan submenu visible:', reportsSubVisible, '| Setting closed:', settingsSubClosed);

  // Verify footer is visible
  const footerVisible = await page.locator('text=Keluar').isVisible();
  console.log('Footer "Keluar" visible when Laporan is open:', footerVisible);

  console.log('\n--- Test 2: Direct Refresh at /admin/setting/printer ---');
  await page.goto('http://localhost:3000/admin/setting/printer');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  const settingGroupOpen = await page.locator('[data-testid="submenu-container-settings"]').isVisible();
  console.log('Settings group automatically open on refresh:', settingGroupOpen);

  const printerActive = await page.locator('[data-testid="submenu-item-settings.printer"]').evaluate((el) => {
    return el.className.includes('bg-black') && el.className.includes('text-white');
  });
  console.log('Printer submenu highlighted/active:', printerActive);

  const breadcrumbText = await page.locator('nav[aria-label="Breadcrumb"]').innerText();
  console.log('Breadcrumb text at /admin/setting/printer:', breadcrumbText.replace(/\s+/g, ' '));

  console.log('\n--- Test 3: Breadcrumbs on various submenus ---');
  await page.click('[data-testid="menu-parent-studio"]');
  await page.waitForTimeout(300);
  const studioBreadcrumb = await page.locator('nav[aria-label="Breadcrumb"]').innerText();
  console.log('Breadcrumb for Studio Foto:', studioBreadcrumb.replace(/\s+/g, ' '));

  await page.click('[data-testid="menu-parent-booking"]');
  await page.waitForTimeout(300);
  const bookingBreadcrumb = await page.locator('nav[aria-label="Breadcrumb"]').innerText();
  console.log('Breadcrumb for Booking:', bookingBreadcrumb.replace(/\s+/g, ' '));

  console.log('\n--- Test 4: Mobile Drawer (< 768px) ---');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(400);

  const hamburgerVisible = await page.locator('[data-testid="mobile-hamburger-btn"]').isVisible();
  console.log('Mobile hamburger button visible:', hamburgerVisible);

  console.log('Opening mobile drawer...');
  await page.click('[data-testid="mobile-hamburger-btn"]');
  await page.waitForTimeout(400);
  const drawerVisible = await page.locator('[data-testid="mobile-drawer-panel"]').isVisible();
  console.log('Drawer panel visible:', drawerVisible);

  console.log('Clicking "Riwayat Cetak" inside mobile drawer...');
  // Ensure booking group is open
  const bookingOpen = await page.locator('[data-testid="submenu-container-booking"]').isVisible();
  if (!bookingOpen) {
    await page.click('[data-testid="menu-parent-booking"]');
    await page.waitForTimeout(300);
  }
  await page.click('[data-testid="submenu-item-booking.print_history"]');
  await page.waitForTimeout(400);

  const drawerClosedAfterClick = !(await page.locator('[data-testid="mobile-drawer-panel"]').isVisible());
  console.log('Drawer automatically closed after selection:', drawerClosedAfterClick);
  console.log('Current URL:', page.url());
  const mobileBreadcrumb = await page.locator('nav[aria-label="Breadcrumb"]').innerText();
  console.log('Mobile Breadcrumb:', mobileBreadcrumb.replace(/\s+/g, ' '));

  console.log('\nAll tests completed successfully!');
  await browser.close();
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
