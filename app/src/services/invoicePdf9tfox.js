const path = require('path');
const fs = require('fs');

// ============================================================
// 9TFox invoice PDF renderer (PDFKit).
// Ports the three imported "Korean Invoice" layouts — Ignition (1A),
// Blueprint (1B), Minimal (1C) — into full-bleed dark PDF pages that mirror
// the 9tfox-design-system brand (charcoal void + ignition orange #ff6d00).
// Fonts fall back to the bundled Pretendard (covers Korean + Latin).
// ============================================================

const C = {
  bg: '#0a0a0a',
  bgMin: '#050505',
  low: '#0f0f0f',
  high: '#1a1a1a',
  accent: '#ff6d00',
  onAccent: '#000000',
  white: '#ffffff',
  variant: '#b3b3b3',
  muted: '#666666',
  tertiary: '#ffb380',
  line: '#333333',
  hairline: '#1a1a1a'
};

function up(s) {
  return String(s == null ? '' : s).toUpperCase();
}

function resolveUploadPath(uploadsDir, storedPath) {
  if (!storedPath) return null;
  const file = path.join(uploadsDir, storedPath.replace('/uploads/', ''));
  return fs.existsSync(file) ? file : null;
}

// Build the normalized data the layouts draw from.
function buildData(ctx) {
  const { invoice, items, banks, isEn, currency, formatAmount } = ctx;

  const rows = items.map((it, i) => {
    let ko = it.details || '';
    if (it.detail_mode === 'itemized' && it.subItems && it.subItems.length) {
      ko = it.subItems.map((s) => (s.title ? s.title + ' ' : '') + (s.description || '')).join(', ');
    }
    return {
      code: String(i + 1).padStart(2, '0'),
      en: it.title || '',
      ko: (ko || '').replace(/\n/g, ' '),
      qty: String(it.quantity),
      rateF: formatAmount(it.unit_price, currency),
      amountF: formatAmount(it.amount, currency)
    };
  });

  let notes = [];
  try { notes = JSON.parse(invoice.notes || '[]'); }
  catch (e) { notes = invoice.notes ? [invoice.notes] : []; }

  const bankList = (banks && banks.length > 0)
    ? banks.map((ba) => ({
        name: isEn ? (ba.bank_name_en || ba.bank_name) : ba.bank_name,
        account: ba.account_number || '',
        swift: (ba.show_swift && ba.swift_code) ? ba.swift_code : '',
        branch: isEn ? (ba.branch_en || ba.branch || '') : (ba.branch || '')
      }))
    : (invoice.company_bank_info
        ? [{ name: (isEn ? (invoice.company_bank_info_en || invoice.company_bank_info) : invoice.company_bank_info), account: '', swift: '', branch: '' }]
        : []);

  return {
    issuer: {
      nameMain: invoice.company_name_en || invoice.company_name || '',
      nameSub: (invoice.company_name && invoice.company_name_en && invoice.company_name !== invoice.company_name_en) ? invoice.company_name : '',
      reg: invoice.company_business_number || '',
      address: (isEn ? (invoice.company_address_en || invoice.company_address || '') : (invoice.company_address || '')).replace(/\n/g, ' '),
      email: isEn ? (invoice.company_email_en || invoice.company_email || '') : (invoice.company_email || ''),
      phone: isEn ? (invoice.company_phone_en || invoice.company_phone || '') : (invoice.company_phone || ''),
      website: invoice.company_website || '',
      fax: invoice.company_fax || ''
    },
    billTo: {
      name: invoice.client_name || '',
      address: (invoice.client_address || '').replace(/\n/g, ' '),
      reg: invoice.client_business_number || ''
    },
    meta: {
      number: invoice.invoice_number || '',
      issued: invoice.issue_date || '',
      due: invoice.validity_period || ''
    },
    totals: {
      subtotalF: formatAmount(invoice.subtotal || 0, currency),
      vatF: formatAmount(invoice.tax_amount || 0, currency),
      totalF: formatAmount(invoice.total_amount || 0, currency),
      taxRate: invoice.tax_rate,
      curCode: currency
    },
    rows,
    banks: (invoice.show_bank_info !== 0) ? bankList : [],
    notes,
    flags: {
      show_logo: invoice.show_logo !== 0
    }
  };
}

// Fill the whole page with the template background color.
function paintBackground(doc, bg) {
  doc.save();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(bg);
  doc.restore();
}

// ---------------- 1A · Ignition Header ----------------
function renderIgnition(doc, ctx, d) {
  const W = doc.page.width;
  const M = 44;
  paintBackground(doc, C.bg);

  // orange header band
  const bandH = 116;
  doc.save().rect(0, 0, W, bandH).fill(C.accent).restore();

  let logoBottom = 44;
  if (d.flags.show_logo) {
    const logo = resolveUploadPath(ctx.uploadsDir, ctx.invoice.logo_path);
    if (logo) {
      try { doc.image(logo, M, 30, { fit: [120, 26] }); logoBottom = 30 + 30; } catch (e) { /* skip */ }
    }
  }
  doc.font(ctx.fontBold).fontSize(22).fillColor(C.onAccent).text(d.issuer.nameMain, M, logoBottom, { lineBreak: false });
  let iy = doc.y + 2;
  if (d.issuer.nameSub) { doc.font(ctx.fontRegular).fontSize(9).fillColor(C.onAccent).text(d.issuer.nameSub, M, iy); iy = doc.y; }
  doc.font(ctx.fontRegular).fontSize(7.5).fillColor(C.onAccent).opacity(0.85);
  const issuerLines = [
    d.issuer.reg ? `${ctx.L.businessNumber} ${d.issuer.reg}` : '',
    d.issuer.address,
    [d.issuer.email, d.issuer.phone].filter(Boolean).join('  ·  ')
  ].filter(Boolean).join('\n');
  doc.text(issuerLines, M, iy + 4, { width: W * 0.55, lineGap: 2 });
  doc.opacity(1);

  // INVOICE title (right)
  doc.font(ctx.fontBold).fontSize(30).fillColor(C.onAccent).text('INVOICE', W - M - 220, 30, { width: 220, align: 'right' });
  doc.font(ctx.fontBold).fontSize(11).fillColor(C.onAccent).text(up(ctx.L.title), W - M - 220, 66, { width: 220, align: 'right', characterSpacing: 3 });

  // meta strip
  let y = bandH;
  const stripH = 60;
  doc.save().rect(0, y, W, stripH).fill(C.low).restore();
  const cols = [
    { label: `${ctx.isEn ? 'Invoice No' : '번호'}`, value: d.meta.number || '-' },
    { label: `${ctx.isEn ? 'Issued' : '발행일'}`, value: d.meta.issued || '-' },
    { label: `${ctx.isEn ? 'Terms' : '만기'}`, value: d.meta.due || '-' }
  ];
  const colW = (W - M * 2) / 3;
  cols.forEach((c, i) => {
    const cx = M + colW * i;
    doc.font(ctx.fontBold).fontSize(7.5).fillColor(C.accent).text(up(c.label), cx, y + 16, { width: colW - 10, characterSpacing: 1.5 });
    doc.font(ctx.fontRegular).fontSize(12).fillColor(C.white).text(c.value, cx, y + 30, { width: colW - 10 });
  });
  y += stripH;

  // bill to
  y += 24;
  doc.font(ctx.fontBold).fontSize(7.5).fillColor(C.tertiary).text(up(`${ctx.L.recipient} · Bill To`), M, y, { characterSpacing: 1.5 });
  doc.font(ctx.fontBold).fontSize(15).fillColor(C.white).text(d.billTo.name || '-', M, y + 12);
  const billMeta = [d.billTo.address, d.billTo.reg].filter(Boolean).join('  ·  ');
  if (billMeta) doc.font(ctx.fontRegular).fontSize(9).fillColor(C.variant).text(billMeta, M, doc.y + 2, { width: W - M * 2 });
  y = doc.y + 20;

  // line items
  y = drawItemsGrid(doc, ctx, d, y, M, C.bg);

  // totals well
  y += 14;
  const wellW = 250;
  const wellX = W - M - wellW;
  doc.font(ctx.fontRegular).fontSize(9).fillColor(C.variant).text(`${ctx.L.subtotal}`, wellX, y, { width: wellW * 0.55 });
  doc.font(ctx.fontRegular).fontSize(9).fillColor(C.white).text(d.totals.subtotalF, wellX + wellW * 0.55, y, { width: wellW * 0.45, align: 'right' });
  y += 16;
  doc.fillColor(C.variant).text(`${ctx.L.tax} ${d.totals.taxRate}%`, wellX, y, { width: wellW * 0.55 });
  doc.fillColor(C.white).text(d.totals.vatF, wellX + wellW * 0.55, y, { width: wellW * 0.45, align: 'right' });
  y += 20;
  const wellH = 46;
  doc.save().rect(wellX, y, wellW, wellH).fill(C.high).restore();
  doc.save().rect(wellX, y, 3, wellH).fill(C.accent).restore();
  doc.font(ctx.fontRegular).fontSize(8).fillColor(C.muted).text(up(`${ctx.L.total} · 합계`), wellX + 14, y + 10, { characterSpacing: 1 });
  doc.fillColor(C.tertiary).fontSize(8).text(d.totals.curCode, wellX + 14, y + 24);
  doc.font(ctx.fontBold).fontSize(20).fillColor(C.accent).text(d.totals.totalF, wellX + wellW - 150, y + 12, { width: 136, align: 'right' });
  y += wellH + 24;

  // payment rails
  y = drawPaymentAndNotes(doc, ctx, d, y, M, W);
}

// ---------------- 1B · Blueprint Ledger ----------------
function renderBlueprint(doc, ctx, d) {
  const W = doc.page.width;
  const H = doc.page.height;
  paintBackground(doc, C.high);

  const railW = 200;
  // left rail
  doc.save().rect(0, 0, railW, H).fill(C.low).restore();
  doc.save().rect(0, 0, 4, H).fill(C.accent).restore();

  const rx = 24;
  let ry = 44;
  if (d.flags.show_logo) {
    const logo = resolveUploadPath(ctx.uploadsDir, ctx.invoice.logo_path);
    if (logo) { try { doc.image(logo, rx, ry, { fit: [100, 22] }); ry += 28; } catch (e) { /* skip */ } }
  }
  doc.font(ctx.fontBold).fontSize(18).fillColor(C.white).text(d.issuer.nameMain, rx, ry, { width: railW - rx - 12 });
  ry = doc.y;
  if (d.issuer.nameSub) { doc.font(ctx.fontRegular).fontSize(8).fillColor(C.muted).text(d.issuer.nameSub, rx, ry, { width: railW - rx - 12 }); ry = doc.y; }
  ry += 20;

  ry = railBlock(doc, ctx, rx, ry, railW, up(`${ctx.L.supplier} · From`), [
    d.issuer.reg ? `${ctx.L.businessNumber}\n${d.issuer.reg}` : '',
    d.issuer.address,
    d.issuer.email,
    (d.issuer.website ? d.issuer.website : ''),
    (d.issuer.fax ? `FAX ${d.issuer.fax}` : '')
  ].filter(Boolean).join('\n\n'));

  ry = railBlock(doc, ctx, rx, ry + 18, railW, up(`${ctx.L.recipient} · Bill To`), [
    d.billTo.name, d.billTo.address, d.billTo.reg
  ].filter(Boolean).join('\n'), true);

  if (d.banks.length > 0) {
    const wire = d.banks.map((b) => [b.name, b.swift, b.account].filter(Boolean).join('\n')).join('\n\n');
    railBlock(doc, ctx, rx, ry + 18, railW, up('Wire · SWIFT'), wire, false, C.tertiary);
  }

  // main column
  const M = railW + 30;
  const mainW = W - M - 30;
  let y = 44;
  doc.font(ctx.fontBold).fontSize(46).fillColor(C.white).text('INVOICE', M, y, { lineBreak: false });
  doc.font(ctx.fontRegular).fontSize(8).fillColor(C.variant);
  const metaLines = [
    `NO   ${d.meta.number || '-'}`,
    `ISSUED   ${d.meta.issued || '-'}`,
    d.meta.due ? `TERMS   ${d.meta.due}` : ''
  ].filter(Boolean);
  doc.text(metaLines.join('\n'), M, y + 6, { width: mainW, align: 'right', lineGap: 3 });
  y += 58;
  doc.font(ctx.fontRegular).fontSize(9).fillColor(C.muted).text(up('청구서 · KR → International'), M, y, { characterSpacing: 2 });
  y += 26;

  y = drawItemsGrid(doc, ctx, d, y, M, C.high, mainW, C.accent);

  // totals
  y += 14;
  const wellW = 220;
  const wellX = W - 30 - wellW;
  doc.font(ctx.fontRegular).fontSize(9).fillColor(C.variant).text(ctx.L.subtotal, wellX, y, { width: wellW * 0.55 });
  doc.fillColor(C.white).text(d.totals.subtotalF, wellX + wellW * 0.55, y, { width: wellW * 0.45, align: 'right' });
  y += 16;
  doc.fillColor(C.variant).text(`${ctx.L.tax} ${d.totals.taxRate}%`, wellX, y, { width: wellW * 0.55 });
  doc.fillColor(C.white).text(d.totals.vatF, wellX + wellW * 0.55, y, { width: wellW * 0.45, align: 'right' });
  y += 20;
  doc.save().moveTo(wellX, y).lineTo(wellX + wellW, y).lineWidth(2).strokeColor(C.accent).stroke().restore();
  y += 10;
  doc.font(ctx.fontRegular).fontSize(9).fillColor(C.muted).text(up(`${ctx.L.total} ${d.totals.curCode}`), wellX, y + 6, { characterSpacing: 1 });
  doc.font(ctx.fontBold).fontSize(22).fillColor(C.accent).text(d.totals.totalF, wellX + wellW - 140, y, { width: 140, align: 'right' });
  y += 34;

  if (d.notes.length > 0) {
    doc.font(ctx.fontRegular).fontSize(8).fillColor(C.muted);
    doc.text(d.notes.map((n, i) => `${i + 1}. ${(n || '').replace(/\n/g, ' ')}`).join('\n'), M, y, { width: mainW, lineGap: 2 });
  }
}

// ---------------- 1C · Minimal Void ----------------
function renderMinimal(doc, ctx, d) {
  const W = doc.page.width;
  const M = 56;
  paintBackground(doc, C.bgMin);

  let y = 56;
  if (d.flags.show_logo) {
    const logo = resolveUploadPath(ctx.uploadsDir, ctx.invoice.logo_path);
    if (logo) { try { doc.image(logo, M, y, { fit: [90, 20] }); y += 26; } catch (e) { /* skip */ } }
  }
  doc.font(ctx.fontBold).fontSize(16).fillColor(C.white).text(d.issuer.nameMain, M, y, { lineBreak: false });
  if (d.issuer.nameSub) doc.font(ctx.fontRegular).fontSize(8).fillColor(C.muted).text(d.issuer.nameSub, M, doc.y + 1);

  doc.font(ctx.fontRegular).fontSize(8).fillColor(C.accent).text(up('Invoice · 청구서'), W - M - 200, 56, { width: 200, align: 'right', characterSpacing: 3 });
  doc.font(ctx.fontRegular).fontSize(9).fillColor(C.white).text(d.meta.number || '-', W - M - 200, 72, { width: 200, align: 'right' });

  y = Math.max(doc.y, y) + 24;
  doc.save().moveTo(M, y).lineTo(W - M, y).lineWidth(1).strokeColor(C.accent).stroke().restore();
  y += 24;

  // three columns
  const colW = (W - M * 2) / 3;
  const c1 = [
    up('From'),
    d.issuer.reg ? `${ctx.L.businessNumber} ${d.issuer.reg}` : '',
    d.issuer.address, d.issuer.email
  ].filter(Boolean);
  const c2 = [up('Bill To'), d.billTo.name, d.billTo.address, d.billTo.reg].filter(Boolean);
  const c3 = [up('Dates'), `Issued  ${d.meta.issued || '-'}`, d.meta.due ? `Terms  ${d.meta.due}` : ''].filter(Boolean);
  [c1, c2, c3].forEach((col, i) => {
    const cx = M + colW * i;
    doc.font(ctx.fontBold).fontSize(7.5).fillColor(C.muted).text(col[0], cx, y, { width: colW - 12, characterSpacing: 1.5 });
    doc.font(ctx.fontRegular).fontSize(9).fillColor(C.variant).text(col.slice(1).join('\n'), cx, y + 14, { width: colW - 12, lineGap: 2 });
  });
  y += 90;

  // item list (flex rows)
  doc.font(ctx.fontRegular);
  for (const it of d.rows) {
    if (y > doc.page.height - 140) { doc.addPage(); paintBackground(doc, C.bgMin); y = 56; }
    doc.font(ctx.fontRegular).fontSize(12).fillColor(C.white).text(it.en, M, y, { width: W - M * 2 - 120 });
    const sub = [it.ko, `${it.qty} @ ${it.rateF}`].filter(Boolean).join(' · ');
    doc.font(ctx.fontRegular).fontSize(8).fillColor(C.muted).text(sub, M, doc.y + 2, { width: W - M * 2 - 120 });
    const rowBottom = doc.y;
    doc.font(ctx.fontRegular).fontSize(12).fillColor(C.white).text(it.amountF, W - M - 120, y, { width: 120, align: 'right' });
    y = Math.max(rowBottom, y) + 12;
    doc.save().moveTo(M, y).lineTo(W - M, y).lineWidth(0.5).strokeColor(C.line).stroke().restore();
    y += 14;
  }

  y += 16;
  // bottom: left small print, right big total
  const leftLines = [`${ctx.L.tax} ${d.totals.taxRate}% · ${d.totals.vatF}`];
  if (d.banks.length > 0) leftLines.push(d.banks.map((b) => `Wire · ${[b.name, b.swift, b.account].filter(Boolean).join(' ')}`).join('\n'));
  d.notes.forEach((n) => leftLines.push((n || '').replace(/\n/g, ' ')));
  doc.font(ctx.fontRegular).fontSize(8).fillColor(C.muted).text(leftLines.join('\n'), M, y, { width: 300, lineGap: 2 });

  doc.font(ctx.fontRegular).fontSize(8).fillColor(C.muted).text(up(`${ctx.L.total} · ${d.totals.curCode}`), W - M - 220, y, { width: 220, align: 'right', characterSpacing: 1.5 });
  doc.font(ctx.fontBold).fontSize(34).fillColor(C.accent).text(d.totals.totalF, W - M - 260, y + 12, { width: 260, align: 'right' });
  doc.font(ctx.fontRegular).fontSize(8).fillColor(C.muted).text(`Subtotal ${d.totals.subtotalF}`, W - M - 220, y + 52, { width: 220, align: 'right' });
}

// Shared: a small labeled text block in the Blueprint left rail.
function railBlock(doc, ctx, x, y, railW, label, body, nameBold, labelColor) {
  doc.font(ctx.fontBold).fontSize(7.5).fillColor(labelColor || C.accent).text(label, x, y, { width: railW - x - 12, characterSpacing: 1.5 });
  y = doc.y + 4;
  if (nameBold) {
    const lines = body.split('\n');
    doc.font(ctx.fontBold).fontSize(9).fillColor(C.white).text(lines[0], x, y, { width: railW - x - 12 });
    y = doc.y;
    if (lines.length > 1) {
      doc.font(ctx.fontRegular).fontSize(8).fillColor(C.variant).text(lines.slice(1).join('\n'), x, y + 2, { width: railW - x - 12, lineGap: 2 });
      y = doc.y;
    }
  } else {
    doc.font(ctx.fontRegular).fontSize(8).fillColor(C.variant).text(body, x, y, { width: railW - x - 12, lineGap: 2 });
    y = doc.y;
  }
  return y;
}

// Shared: line-items grid (Ignition + Blueprint). Returns new y.
function drawItemsGrid(doc, ctx, d, y, M, bg, widthOverride, headRule) {
  const W = doc.page.width;
  const gridW = widthOverride || (W - M * 2);
  const showCode = true;
  // columns: [code][desc][qty][rate][amount]
  const codeW = showCode ? 30 : 0;
  const qtyW = 60, rateW = 80, amtW = 88;
  const descW = gridW - codeW - qtyW - rateW - amtW;
  const xCode = M, xDesc = M + codeW, xQty = xDesc + descW, xRate = xQty + qtyW, xAmt = xRate + rateW;

  doc.font(ctx.fontBold).fontSize(7.5).fillColor(C.muted);
  if (showCode) doc.text('#', xCode, y, { width: codeW, characterSpacing: 1 });
  doc.text(up(`${ctx.L.itemDetails} · 내역`), xDesc, y, { width: descW - 6, characterSpacing: 1 });
  doc.text(up(ctx.L.quantity), xQty, y, { width: qtyW - 4, align: 'right', characterSpacing: 1 });
  doc.text('RATE', xRate, y, { width: rateW - 4, align: 'right', characterSpacing: 1 });
  doc.text(up(ctx.L.supplyAmount).slice(0, 8), xAmt, y, { width: amtW, align: 'right', characterSpacing: 1 });
  y += 14;
  doc.save().moveTo(M, y).lineTo(M + gridW, y).lineWidth(headRule ? 2 : 1).strokeColor(headRule || C.line).stroke().restore();
  y += 10;

  for (const it of d.rows) {
    if (y > doc.page.height - 150) { doc.addPage(); paintBackground(doc, bg); y = 44; }
    if (showCode) doc.font(ctx.fontRegular).fontSize(8).fillColor(C.accent).text(it.code, xCode, y, { width: codeW });
    doc.font(ctx.fontRegular).fontSize(10).fillColor(C.white).text(it.en, xDesc, y, { width: descW - 6 });
    const descBottom = doc.y;
    if (it.ko) doc.font(ctx.fontRegular).fontSize(8).fillColor(C.muted).text(it.ko, xDesc, doc.y + 1, { width: descW - 6 });
    const rowBottom = doc.y;
    doc.font(ctx.fontRegular).fontSize(9).fillColor(C.variant).text(it.qty, xQty, y, { width: qtyW - 4, align: 'right' });
    doc.text(it.rateF, xRate, y, { width: rateW - 4, align: 'right' });
    doc.fillColor(C.white).text(it.amountF, xAmt, y, { width: amtW, align: 'right' });
    y = Math.max(rowBottom, descBottom, y) + 10;
    doc.save().moveTo(M, y).lineTo(M + gridW, y).lineWidth(0.5).strokeColor(C.hairline).stroke().restore();
    y += 8;
  }
  return y;
}

// Shared: Ignition payment band + footer notes. Returns new y.
function drawPaymentAndNotes(doc, ctx, d, y, M, W) {
  if (d.banks.length > 0) {
    if (y > doc.page.height - 150) { doc.addPage(); paintBackground(doc, C.bg); y = 44; }
    const bandTop = y;
    const half = (W - M * 2) / 2;
    let maxBottom = y + 20;
    d.banks.slice(0, 2).forEach((b, i) => {
      const bx = M + half * i;
      doc.font(ctx.fontBold).fontSize(7.5).fillColor(C.accent).text(up(i === 0 ? 'Wire · 계좌 이체' : 'Alt · 대체 계좌'), bx, y + 20, { width: half - 20, characterSpacing: 1.5 });
      const lines = [
        `BANK · ${b.name}${b.branch ? ` (${b.branch})` : ''}`,
        b.swift ? `SWIFT/BIC · ${b.swift}` : '',
        b.account ? `ACCT · ${b.account}` : '',
        `HOLDER · ${d.issuer.nameMain}`
      ].filter(Boolean).join('\n');
      doc.font(ctx.fontRegular).fontSize(8).fillColor(C.variant).text(lines, bx, y + 34, { width: half - 20, lineGap: 3 });
      maxBottom = Math.max(maxBottom, doc.y);
    });
    // band background behind the payment block
    doc.save().rect(0, bandTop, W, (maxBottom - bandTop) + 20).fill(C.low).restore();
    // redraw text over the band (fill painted after would cover it, so repaint)
    d.banks.slice(0, 2).forEach((b, i) => {
      const bx = M + half * i;
      doc.font(ctx.fontBold).fontSize(7.5).fillColor(C.accent).text(up(i === 0 ? 'Wire · 계좌 이체' : 'Alt · 대체 계좌'), bx, bandTop + 20, { width: half - 20, characterSpacing: 1.5 });
      const lines = [
        `BANK · ${b.name}${b.branch ? ` (${b.branch})` : ''}`,
        b.swift ? `SWIFT/BIC · ${b.swift}` : '',
        b.account ? `ACCT · ${b.account}` : '',
        `HOLDER · ${d.issuer.nameMain}`
      ].filter(Boolean).join('\n');
      doc.font(ctx.fontRegular).fontSize(8).fillColor(C.variant).text(lines, bx, bandTop + 34, { width: half - 20, lineGap: 3 });
    });
    y = maxBottom + 24;
  }

  if (d.notes.length > 0) {
    if (y > doc.page.height - 80) { doc.addPage(); paintBackground(doc, C.bg); y = 44; }
    doc.font(ctx.fontRegular).fontSize(8).fillColor(C.muted).text(
      d.notes.map((n, i) => `${i + 1}. ${(n || '').replace(/\n/g, ' ')}`).join('\n'),
      M, y, { width: W - M * 2, lineGap: 2 });
    y = doc.y;
  }
  return y;
}

/**
 * Render a 9TFox invoice onto an existing PDFKit document.
 * @param {PDFDocument} doc
 * @param {object} ctx - { templateId, invoice, items, banks, currency, isEn, L, fontRegular, fontBold, formatAmount, uploadsDir }
 */
function render9TFoxInvoice(doc, ctx) {
  const d = buildData(ctx);
  if (ctx.templateId === '9tfox-blueprint') {
    renderBlueprint(doc, ctx, d);
  } else if (ctx.templateId === '9tfox-minimal') {
    renderMinimal(doc, ctx, d);
  } else {
    renderIgnition(doc, ctx, d);
  }
}

module.exports = { render9TFoxInvoice };
