/**
 * Renders a screenshot of the PayRisk AI merchant SMS consent attestation UI.
 * Run: node marketing/render-sms-attestation-screenshot.mjs
 */
import puppeteer from 'puppeteer';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '..', 'public', 'sms-merchant-attestation.png');

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: #f3f4f6;
    padding: 32px;
    width: 880px;
  }
  .window {
    background: #fff;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    box-shadow: 0 10px 40px rgba(15,23,42,.12);
    overflow: hidden;
  }
  .topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 20px; border-bottom: 1px solid #e5e7eb; background: #fff;
  }
  .logo { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; color: #111; }
  .logo-i {
    width: 28px; height: 28px; background: #2563eb; border-radius: 8px;
    color: #fff; display: flex; align-items: center; justify-content: center; font-size: 13px;
  }
  .pill {
    font-size: 12px; font-weight: 600; color: #2563eb; background: #eff6ff;
    padding: 5px 12px; border-radius: 6px;
  }
  .body { padding: 24px 28px 28px; }
  h1 { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 4px; }
  .sub { font-size: 13px; color: #6b7280; margin-bottom: 20px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  label { display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px; }
  input[type="text"], input[type="tel"], input[type="email"] {
    width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px;
    font-size: 14px; background: #fff; color: #111;
  }
  .full { grid-column: 1 / -1; }
  .consent {
    margin-top: 18px; display: flex; align-items: flex-start; gap: 12px;
    padding: 14px 16px; border: 1px solid #fde68a; background: #fffbeb; border-radius: 8px;
  }
  .consent input { margin-top: 3px; width: 18px; height: 18px; flex-shrink: 0; }
  .consent p { font-size: 14px; color: #374151; line-height: 1.45; }
  .consent a { color: #2563eb; }
  .actions { margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end; }
  .btn { padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; border: none; }
  .btn-ghost { background: #f3f4f6; color: #374151; }
  .btn-primary { background: #2563eb; color: #fff; }
  .callout {
    margin-top: 12px; font-size: 12px; color: #92400e; background: #fff7ed;
    border: 1px dashed #fdba74; border-radius: 6px; padding: 8px 10px;
  }
</style>
</head>
<body>
  <div class="window">
    <div class="topbar">
      <div class="logo"><div class="logo-i">P</div> PayRisk AI</div>
      <span class="pill">Customers · Add / Edit</span>
    </div>
    <div class="body">
      <h1>Add Customer</h1>
      <p class="sub">Demo UI for A2P review — SMS consent attestation (unchecked by default)</p>
      <div class="grid">
        <div>
          <label>Customer name</label>
          <input type="text" value="James Carter" readonly />
        </div>
        <div>
          <label>Company</label>
          <input type="text" value="Carter Plumbing LLC" readonly />
        </div>
        <div>
          <label>Email</label>
          <input type="email" value="demo@example.com" readonly />
        </div>
        <div>
          <label>Phone</label>
          <input type="tel" value="+1 (555) 987-6543" readonly />
        </div>
        <div class="full">
          <div class="consent">
            <input type="checkbox" id="att" />
            <p>
              <label for="att">
                I confirm this contact has agreed to receive payment and account-related SMS from my
                business. Required when you <strong>add or change</strong> the phone number, and to use
                <strong>Send SMS</strong>. See
                <a href="#">Terms of Service</a>.
              </label>
            </p>
          </div>
          <div class="callout">Checkbox is unchecked by default — merchant must actively confirm consent before SMS can be sent.</div>
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-ghost" type="button">Cancel</button>
        <button class="btn btn-primary" type="button">Save Customer</button>
      </div>
    </div>
  </div>
</body>
</html>`;

const chromePath =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const launchOpts = { headless: true, args: ['--no-sandbox'] };
if (existsSync(chromePath)) launchOpts.executablePath = chromePath;

const browser = await puppeteer.launch(launchOpts);
const page = await browser.newPage();
await page.setViewport({ width: 940, height: 700, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'load' });
await page.screenshot({ path: outPath, type: 'png' });
await browser.close();
console.log('Saved:', outPath);
