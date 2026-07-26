const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getDatabase } = require('../config/database');
const { INVOICE_TEMPLATES, isValidTemplate, resolveTemplateId, DEFAULT_TEMPLATE_ID } = require('../config/invoiceTemplates');

const router = express.Router();

// Apply auth to all routes
router.use(requireAuth);

// Sample invoice used to render live template previews in the gallery.
function buildSampleData() {
  const invoice = {
    id: 0,
    invoice_number: '9TF-2026-0142',
    issue_date: '2026-07-22',
    validity_period: 'Net 30 · 30일 이내',
    currency: 'USD',
    project_name: 'Enterprise AI Platform',
    client_name: 'Vertex Dynamics GmbH',
    client_address: 'Friedrichstraße 88, 10117 Berlin, Germany',
    client_business_number: 'VAT DE289447116',
    client_email: 'finance@vertexdyn.eu',
    company_name: '나인테일폭스 주식회사',
    company_name_en: '9TFox, Inc.',
    representative: '김구미호',
    representative_en: 'Gumiho Kim',
    company_business_number: '123-45-67890',
    company_address: '서울특별시 강남구 테헤란로 152, 강남파이낸스센터 21F',
    company_address_en: '21F Gangnam Finance Center, 152 Teheran-ro, Gangnam-gu, Seoul',
    company_phone: '+82 2 1234 5678',
    company_phone_en: '+82 2 1234 5678',
    company_email: 'hello@9tfox.io',
    company_email_en: 'hello@9tfox.io',
    company_website: 'https://9tfox.io',
    company_fax: '+82 2 1234 5679',
    company_bank_info: 'KEB Hana Bank 123-456789-01234',
    company_bank_info_en: 'KEB Hana Bank 123-456789-01234',
    logo_path: null,
    stamp_path: null,
    show_logo: 1,
    show_stamp: 1,
    show_website: 1,
    show_fax: 1,
    show_bank_info: 1,
    show_logo_watermark: 0,
    column_widths: null,
    subtotal: 48400,
    tax_rate: 0,
    tax_amount: 0,
    total_amount: 48400,
    notes: JSON.stringify([
      'Zero-rated for export under Korean VAT Act Art. 21.',
      'Payment due within 30 days · 30일 이내 결제.'
    ])
  };

  const items = [
    { id: 1, title: 'AI Architecture Advisory', details: 'AI 아키텍처 자문', quantity: '120 hrs', unit_price: 180, amount: 21600, detail_mode: 'text', subItems: [] },
    { id: 2, title: 'Enterprise System Design', details: '엔터프라이즈 시스템 설계', quantity: '1 project', unit_price: 14000, amount: 14000, detail_mode: 'text', subItems: [] },
    { id: 3, title: 'Kinetic Scaling · DevOps', details: '키네틱 스케일링 · 데브옵스', quantity: '80 hrs', unit_price: 160, amount: 12800, detail_mode: 'text', subItems: [] }
  ];

  const selectedBankAccounts = [
    { id: 1, bank_name: 'KEB Hana Bank', bank_name_en: 'KEB Hana Bank', account_number: '123-456789-01234', branch: '', branch_en: '', show_swift: 1, swift_code: 'KOEXKRSE' },
    { id: 2, bank_name: 'Wise', bank_name_en: 'Wise', account_number: '9tfox@wise.com', branch: '', branch_en: '', show_swift: 0, swift_code: '' }
  ];

  return { invoice, items, selectedBankAccounts };
}

// Gallery: browse templates and assign one per organization (company).
router.get('/', (req, res) => {
  const db = getDatabase();
  const companies = db.prepare('SELECT id, name, is_default, invoice_template FROM companies ORDER BY is_default DESC, name ASC').all();
  companies.forEach((c) => { c.invoice_template = resolveTemplateId(c.invoice_template); });

  res.render('invoice-templates/gallery', {
    templates: INVOICE_TEMPLATES,
    companies,
    defaultTemplateId: DEFAULT_TEMPLATE_ID
  });
});

// Standalone live preview of a single template (embedded via iframe in gallery).
router.get('/preview/:id', (req, res) => {
  const templateId = resolveTemplateId(req.params.id);
  const { invoice, items, selectedBankAccounts } = buildSampleData();

  res.render('invoice-templates/preview', {
    templateId,
    invoice,
    items,
    selectedBankAccounts,
    layout: false
  });
});

// Assign a template to a company.
router.post('/companies/:id', (req, res) => {
  const db = getDatabase();
  const { template } = req.body;

  if (!isValidTemplate(template)) {
    return res.status(400).json({ error: 'Invalid template' });
  }

  const company = db.prepare('SELECT id FROM companies WHERE id = ?').get(req.params.id);
  if (!company) {
    return res.status(404).json({ error: 'Company not found' });
  }

  try {
    db.prepare('UPDATE companies SET invoice_template = ? WHERE id = ?').run(template, req.params.id);
    res.json({ success: true, template });
  } catch (err) {
    console.error('Error assigning invoice template:', err);
    res.status(500).json({ error: 'Failed to assign template' });
  }
});

module.exports = router;
