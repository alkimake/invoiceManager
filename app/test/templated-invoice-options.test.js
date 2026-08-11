const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ejs = require('ejs');

const partialsDir = path.join(__dirname, '..', 'src', 'views', 'invoices', 'partials');
const cardPath = path.join(partialsDir, 'invoice-card.ejs');

function renderTemplate(templateId) {
  return ejs.render(fs.readFileSync(cardPath, 'utf8'), {
    templateId,
    invoice: {
      invoice_number: 'INV-1', issue_date: '2026-08-05', validity_period: '30 days',
      company_name: '9TFox', company_name_en: '9TFox', company_business_number: '123',
      company_address: 'Seoul', company_email: 'hello@example.com', company_phone: '010-1234-5678',
      logo_path: '/logo.png', stamp_path: '/stamp.png',
      client_name: 'Client Co', client_address: 'Client Street', client_business_number: '456',
      client_email: 'client@example.com', client_phone: '+90 555 0100',
      subtotal: 100, tax_amount: 10, total_amount: 110, tax_rate: 10, currency: 'USD',
      notes: '[]', show_logo: 1, show_stamp: 1, show_website: 1, show_fax: 1,
      show_bank_info: 1, show_client_address: 1, show_swift: 1
    },
    items: [],
    selectedBankAccounts: [{
      id: 7, bank_name: 'Bank', account_number: '123-456', account_holder: '9TFox',
      swift_code: 'ABCDEF12', swift_bank_branch: 'Bank Main', swift_bank_address: 'Seoul', bank_code: '001'
    }],
    lang: 'en',
    t: (key) => key,
    formatAmount: (value) => String(value),
    nl2br: (value) => value
  }, { filename: cardPath });
}

for (const templateId of ['9tfox-ignition', '9tfox-blueprint', '9tfox-minimal']) {
  test(`${templateId} exposes option hooks and structured recipient details`, () => {
    const html = renderTemplate(templateId);
    assert.match(html, /class="client-info-row/);
    assert.match(html, /client-phone/);
    assert.match(html, /class="bank-local-row/);
    assert.match(html, /class="bank-swift-row/);
    assert.match(html, /id="taxIdRow"/);
    assert.match(html, /id="stampImage"/);
    assert.match(html, /id="logoWatermark"/);
  });
}

test('9tfox ignition uses the compact payment-footer layout', () => {
  const html = renderTemplate('9tfox-ignition');
  assert.match(html, /class="[^\"]*tf-ignition-header/);
  assert.match(html, /class="[^\"]*tf-ignition-meta/);
  assert.match(html, /class="[^\"]*tf-ignition-bill-to/);
  assert.match(html, /class="[^\"]*tf-payment-footer/);
});

test('9tfox templates expose full-bleed A4 print hooks', () => {
  const html = renderTemplate('9tfox-ignition');
  assert.match(html, /class="[^\"]*tf-print-full-bleed/);
  assert.match(html, /class="[^\"]*tf-print-a4-card/);
});
