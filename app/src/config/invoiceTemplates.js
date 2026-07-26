// Invoice design template registry.
//
// Each organization (company) can choose one of these templates for how its
// invoices are rendered on screen, when printed, and when exported to PDF via
// the browser print dialog. Templates are pure presentation: they all render
// the exact same invoice data through the shared `invoices/partials/invoice-body`
// partial and only differ in the scoped CSS defined in
// `invoices/partials/invoice-styles`.
//
// The `default` template preserves the original look. The three `9TFox-*`
// templates were added as a starter gallery.

const DEFAULT_TEMPLATE_ID = 'default';

// The three 9TFox templates mirror the layouts from the imported
// "Korean Invoice" design (9tfox-design-system): 1A Ignition Header,
// 1B Blueprint Ledger, 1C Minimal Void. They share the brand's dark
// "Tonal Depth & The Ignition Core" aesthetic (charcoal void + a single
// high-energy orange, #ff6d00).
const INVOICE_TEMPLATES = [
  {
    id: 'default',
    name: 'Default',
    // i18n keys for gallery copy (fall back to inline name/description)
    nameKey: 'invoiceTemplate.default_name',
    descKey: 'invoiceTemplate.default_desc',
    accent: '#2563eb',
    dark: false,
  },
  {
    id: '9tfox-ignition',
    name: '9TFox-Ignition',
    nameKey: 'invoiceTemplate.ignition_name',
    descKey: 'invoiceTemplate.ignition_desc',
    accent: '#ff6d00',
    dark: true,
  },
  {
    id: '9tfox-blueprint',
    name: '9TFox-Blueprint',
    nameKey: 'invoiceTemplate.blueprint_name',
    descKey: 'invoiceTemplate.blueprint_desc',
    accent: '#ff6d00',
    dark: true,
  },
  {
    id: '9tfox-minimal',
    name: '9TFox-Minimal',
    nameKey: 'invoiceTemplate.minimal_name',
    descKey: 'invoiceTemplate.minimal_desc',
    accent: '#ff6d00',
    dark: true,
  },
];

const TEMPLATE_MAP = INVOICE_TEMPLATES.reduce((acc, tpl) => {
  acc[tpl.id] = tpl;
  return acc;
}, {});

function isValidTemplate(id) {
  return Object.prototype.hasOwnProperty.call(TEMPLATE_MAP, id);
}

// Always returns a valid template object, falling back to the default template.
function getTemplate(id) {
  return TEMPLATE_MAP[id] || TEMPLATE_MAP[DEFAULT_TEMPLATE_ID];
}

// Normalizes any stored/incoming value to a valid template id.
function resolveTemplateId(id) {
  return isValidTemplate(id) ? id : DEFAULT_TEMPLATE_ID;
}

module.exports = {
  DEFAULT_TEMPLATE_ID,
  INVOICE_TEMPLATES,
  isValidTemplate,
  getTemplate,
  resolveTemplateId,
};
