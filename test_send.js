const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console messages
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  try {
    console.log('Navigating to app...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    
    console.log('Logging in...');
    await page.fill('input[placeholder*="Email"]', 'test@dhd.com');
    await page.fill('input[placeholder*="Password"]', 'Test@12345');
    await page.click('button:has-text("Sign In")');
    await page.waitForNavigation({ waitUntil: 'networkidle' });
    
    console.log('Navigating to WhatsApp...');
    await page.click('a:has-text("WhatsApp")');
    await page.waitForTimeout(2000);
    
    console.log('Clicking New Message button...');
    await page.click('button:has-text("New Message")');
    await page.waitForTimeout(500);
    
    console.log('Filling form...');
    await page.fill('input[placeholder*="8761234567"]', '18768412776');
    await page.fill('textarea[placeholder*="Type your message"]', 'Test message from debugging');
    
    console.log('Clicking Send button...');
    await page.click('button:has-text("Send")');
    
    console.log('Waiting for request...');
    await page.waitForTimeout(3000);
    
    console.log('\n=== CONSOLE LOGS ===');
    consoleLogs.forEach(log => console.log(log));
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  await browser.close();
})();
