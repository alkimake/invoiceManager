const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoice-api-'));
process.env.DB_PATH = path.join(tmpDir, 'invoice.db');

const { initDatabase, getDatabase, closeDatabase } = require('../src/config/database');
const api = require('../src/services/invoiceApi');

const originalLog = console.log;
console.log = () => {};
initDatabase();
console.log = originalLog;

const db = getDatabase();
const companyId = db.prepare("INSERT INTO companies (name, is_default) VALUES ('9TFox', 1)").run().lastInsertRowid;

test.after(() => {
  closeDatabase();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const minimal = { project_name: 'Website', items: [{ title: 'Build', unit_price: 1000 }] };

test('new API invoices default to USD, no tax and English validity', () => {
  const invoice = api.createInvoice(minimal);

  assert.equal(invoice.currency, 'USD');
  assert.equal(invoice.tax_rate, 0);
  assert.equal(invoice.total_amount, 1000);
  assert.equal(invoice.validity_period, '1 month from issue date');
});

test('explicit currency, tax and validity still win', () => {
  const invoice = api.createInvoice({ ...minimal, currency: 'KRW', tax_rate: 10, validity_period: '30 days' });

  assert.equal(invoice.currency, 'KRW');
  assert.equal(invoice.tax_rate, 10);
  assert.equal(invoice.total_amount, 1100);
  assert.equal(invoice.validity_period, '30 days');
});

test('display options are copied from the company\'s last invoice', () => {
  const last = api.createInvoice(minimal);
  db.prepare(`
    UPDATE invoices SET show_swift = 1, show_paypal = 1, show_stamp = 0, show_logo = 0,
      show_logo_watermark = 1, column_widths = '{"title":40}'
    WHERE id = ?
  `).run(last.id);

  const invoice = api.createInvoice(minimal);
  const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice.id);

  assert.equal(row.show_swift, 1);
  assert.equal(row.show_paypal, 1);
  assert.equal(row.show_stamp, 0);
  assert.equal(row.show_logo, 0);
  assert.equal(row.show_logo_watermark, 1);
  assert.equal(row.column_widths, '{"title":40}');
});

test('a company without invoices keeps the database display defaults', () => {
  const otherId = db.prepare("INSERT INTO companies (name) VALUES ('Other')").run().lastInsertRowid;
  const invoice = api.createInvoice({ ...minimal, company_id: Number(otherId) });
  const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice.id);

  assert.notEqual(otherId, companyId);
  assert.equal(row.show_swift, 0);
  assert.equal(row.show_stamp, 1);
});
