// Invoice printing utilities

async function openPrintWindow(html: string, printerName?: string, pageSize?: { width: number; height: number }) {
  if (printerName && (window as any).electronAPI?.printToPrinter) {
    try {
      const result = await (window as any).electronAPI.printToPrinter(html, printerName, pageSize);
      if (result && result.success) return;
    } catch (e) {
      console.error('printToPrinter error, falling back to dialog:', e);
    }
  }
  const win = window.open('', '_blank', 'width=800,height=600');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 500);
}

const receiptStyle = `
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', 'Arial', 'Traditional Arabic', 'Consolas', 'Courier New', sans-serif;
    font-weight: 600;
    font-size: 10px;
    color: #000;
    width: 52mm;
    margin: 0 auto;
    padding: 1mm 2mm;
    line-height: 1.5;
  }
  @media print {
    body { margin: 0; padding: 0.5mm 2mm; }
    @page { margin: 0; }
  }
  .c { text-align: center; }
  .r { text-align: right; }
  .b { font-weight: 700; }
  .logo { max-width: 100px; max-height: 45px; margin-bottom: 3px; }
  .sname { font-size: 16px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; }
  .sinfo { font-size: 9px; color: #333; }
  .div { border-top: 2px solid #000; margin: 5px 0; }
  .dash { border-top: 1px dashed #999; margin: 4px 0; }
  .subtitle { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; margin: 3px 0; }
  .il { display: flex; justify-content: space-between; font-size: 10px; font-weight: 600; }
  table.w { width: 100%; border-collapse: collapse; font-size: 10px; }
  table.w th { border-bottom: 2px solid #000; padding: 4px 0; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; }
  table.w th.rt { text-align: right; }
  table.w td { padding: 3px 0; vertical-align: top; }
  table.w td.rt { text-align: right; white-space: nowrap; font-weight: 600; }
  table.w td.ct { text-align: center; }
  .tl { display: flex; justify-content: space-between; padding: 2px 0; font-size: 10px; font-weight: 600; }
  .gt {
    font-size: 15px; font-weight: 700;
    border-top: 3px solid #000; border-bottom: 3px solid #000;
    padding: 4px 0; margin: 3px 0;
  }
  .pay { font-size: 10px; font-weight: 600; text-align: center; margin: 3px 0; }
  .ft { text-align: center; font-size: 10px; font-weight: 600; color: #444; margin-top: 6px; line-height: 1.5; }
  .bc { letter-spacing: 2px; word-spacing: 4px; }
</style>
`;

const a4Style = `
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, 'Traditional Arabic', sans-serif; color: #111; background: white; }
    @media print {
      body { margin: 0; }
      @page { margin: 10mm; }
    }
  </style>
`;

export function printThermalReceipt(data: {
  invoiceNumber: string; storeName: string; storeLogo?: string; storeInfo?: { phone?: string; address?: string }; customer: any;
  items: any[]; subtotal: number; discountPct: number;
  total: number; paymentType: string; installment: any; currency: string; printerName?: string;
}) {
  const { invoiceNumber, storeName, storeLogo, storeInfo, customer, items, subtotal, discountPct, total, paymentType, installment, currency, printerName } = data;
  const fmt = (n: number) => n.toLocaleString('fr-DZ') + ' ' + currency;
  const now = new Date().toLocaleString('fr-DZ');

  const itemsHtml = items.map(i => {
    const lineTotal = i.subtotal;
    const discountAmt = i.discount > 0 ? i.unitPrice * i.quantity * i.discount / 100 : 0;
    return `<tr>
      <td>${i.name}</td>
      <td class="ct">${i.quantity}</td>
      <td class="rt">${fmt(i.unitPrice)}</td>
      <td class="rt">${fmt(lineTotal)}</td>
    </tr>${i.discount > 0 ? `<tr><td colspan="4" class="r" style="color:#888;font-size:7.5px;padding:0 0 2px 0;">remise ${i.discount}% (-${fmt(discountAmt)})</td></tr>` : ''}`;
  }).join('');

  const discountAmt = subtotal * discountPct / 100;

  const html = `<!DOCTYPE html><html>
  <head><meta charset="utf-8"/>${receiptStyle}
  <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap" rel="stylesheet">
  </head>
  <body dir="auto">
    <div class="c">
      ${storeLogo ? `<img src="${storeLogo}" class="logo" />` : ''}
      <div class="sname" dir="auto">${storeName}</div>
      ${storeInfo?.phone ? `<div class="sinfo">${storeInfo.phone}</div>` : ''}
    </div>
    <div class="div"></div>
    <div class="c subtitle">TICKET DE CAISSE</div>
    <div class="il"><span>N°</span><span>${invoiceNumber}</span></div>
    <div class="il"><span>Date</span><span>${now}</span></div>
    ${customer ? `<div class="dash"></div><div class="il"><span>Client</span><span dir="auto">${customer.name}</span></div>${customer.phone ? `<div class="il"><span>Tél</span><span>${customer.phone}</span></div>` : ''}` : ''}
    <div class="dash"></div>
    <table class="w">
      <thead><tr><th>Produit</th><th class="ct">Qté</th><th class="rt">P.U.</th><th class="rt">Total</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="dash"></div>
    <div class="tl"><span>Sous-total</span><span>${fmt(subtotal)}</span></div>
    ${discountPct > 0 ? `<div class="tl"><span>Remise ${discountPct}%</span><span style="color:#888;">-${fmt(discountAmt)}</span></div>` : ''}
    <div class="gt"><div class="tl"><span>TOTAL</span><span>${fmt(total)}</span></div></div>
    ${installment ? `
    <div class="dash"></div>
    <div class="c subtitle">CRÉDIT</div>
    <div class="tl"><span>Total crédit</span><span>${fmt(installment.total)}</span></div>
    <div class="tl"><span>Avance</span><span>${fmt(installment.advance)}</span></div>
    <div class="tl"><span>Restant</span><span>${fmt(installment.remaining)}</span></div>
    <div class="tl"><span>${installment.months} mois ×</span><span>${fmt(installment.monthly)}</span></div>
    ` : `
    <div class="pay">
      Paiement: ${paymentType === 'cash' ? 'Espèces' : paymentType === 'card' ? 'Carte' : 'Crédit'}
    </div>`}
    <div class="div"></div>
    <div class="ft">
      Merci de votre visite !<br>
      <span style="font-size:7.5px;color:#888;">${storeName}</span>
    </div>
    <div class="c bc" style="font-size:11px;margin-top:3px;font-family:'Libre Barcode 128','Code128',monospace;">${invoiceNumber}</div>
  </body></html>`;
  openPrintWindow(html, printerName);
}

export function printProformaInvoice(data: {
  storeName: string; storeLogo?: string; storeInfo?: { phone?: string; address?: string }; customer: any; items: any[];
  subtotal: number; discount: number; total: number;
  paymentType: string; installment: any; currency: string; printerName?: string;
}) {
  const { storeName, storeLogo, storeInfo, customer, items, subtotal, discount, total, paymentType, installment, currency, printerName } = data;
  const fmt = (n: number) => n.toLocaleString('fr-DZ') + ' ' + currency;
  const now = new Date().toLocaleString('fr-DZ');

  const html = `<!DOCTYPE html><html>
  <head><meta charset="utf-8"/>${a4Style}
  <style>
    body { padding: 15mm; font-size: 12px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; }
    .store-section h1 { font-size: 22px; color: #1e293b; margin-bottom: 6px; }
    .badge { display: inline-block; background: #fef3c7; color: #92400e; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; margin-bottom: 6px; }
    .pro-num { font-size: 11px; color: #64748b; }
    .customer-section { text-align: right; }
    .customer-section .name { font-weight: 700; font-size: 14px; color: #1e293b; }
    .customer-section .detail { font-size: 11px; color: #475569; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #f1f5f9; padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; border-bottom: 2px solid #e2e8f0; }
    th.r { text-align: right; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #1e293b; }
    td.r { text-align: right; }
    td.c { text-align: center; }
    .totals-table { margin-top: 8px; margin-left: auto; width: 300px; }
    .totals-table td { padding: 5px 12px; border: none; }
    .totals-table td.r { text-align: right; }
    .totals-table .gt { font-weight: 700; font-size: 16px; border-top: 2px solid #1e293b; padding-top: 8px; color: #4f46e5; }
    .installment-box { margin-top: 25px; padding: 18px 20px; background: linear-gradient(135deg, #faf5ff, #f3e8ff); border: 1px solid #d8b4fe; border-radius: 12px; }
    .installment-box h3 { font-size: 14px; color: #6b21a8; margin-bottom: 12px; }
    .installment-box table { width: 100%; }
    .installment-box td { padding: 4px 0; font-size: 12px; border: none; }
    .installment-box td.r { text-align: right; }
    .installment-box .hl { font-weight: 700; font-size: 16px; color: #6b21a8; }
    .footer { margin-top: 35px; padding-top: 15px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8; line-height: 1.6; }
    .footnote { margin-top: 6px; font-size: 11px; color: #f59e0b; text-align: center; }
  </style></head>
  <body dir="auto">
    <div class="header">
      <div class="store-section">
        ${storeLogo ? `<img src="${storeLogo}" style="max-width:110px;max-height:50px;margin-bottom:4px;" />` : ''}
        <h1 dir="auto">${storeName}</h1>
        ${storeInfo?.phone ? `<div class="detail">Tél: ${storeInfo.phone}</div>` : ''}
        <div class="badge">FACTURE PROFORMA</div>
        <div class="pro-num">${now}</div>
      </div>
      ${customer ? `<div class="customer-section">
        <div class="name" dir="auto">${customer.name}</div>
        ${customer.phone ? `<div class="detail">${customer.phone}</div>` : ''}
        ${customer.address ? `<div class="detail">${customer.address}</div>` : ''}
      </div>` : ''}
    </div>
    <table>
      <thead><tr><th style="width:40%">Produit</th><th class="c">Qté</th><th class="r">P.U.</th><th class="r">Remise</th><th class="r">Total</th></tr></thead>
      <tbody>
        ${items.map(i => `<tr>
          <td>${i.name}</td>
          <td class="c">${i.quantity}</td>
          <td class="r">${fmt(i.unitPrice)}</td>
          <td class="r">${i.discount > 0 ? i.discount + '%' : '-'}</td>
          <td class="r">${fmt(i.subtotal)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <table class="totals-table">
      <tr><td>Sous-total</td><td class="r">${fmt(subtotal)}</td></tr>
      ${discount > 0 ? `<tr><td style="color:#dc2626;">Remise ${discount}%</td><td class="r" style="color:#dc2626;">− ${fmt(subtotal * discount / 100)}</td></tr>` : ''}
      <tr class="gt"><td>TOTAL ${paymentType === 'credit' ? '(Crédit)' : ''}</td><td class="r">${fmt(total)}</td></tr>
    </table>
    ${installment ? `
    <div class="installment-box">
      <h3>Conditions de crédit</h3>
      <table>
        <tr><td>Montant total</td><td class="r"><strong>${fmt(installment.total)}</strong></td></tr>
        <tr><td>Avance initiale</td><td class="r">${fmt(installment.advance)}</td></tr>
        <tr><td>Montant restant</td><td class="r">${fmt(installment.remaining)}</td></tr>
        <tr><td>Durée</td><td class="r">${installment.months} mois</td></tr>
        <tr class="hl"><td>Mensualité</td><td class="r">${fmt(installment.monthly)}</td></tr>
      </table>
    </div>` : ''}
    <div class="footer">
      ${storeName} &mdash; Document non contractuel &mdash; Devis valable 7 jours
    </div>
  </body></html>`;
  openPrintWindow(html, printerName);
}

export function printDetailedInvoice(data: {
  invoiceNumber: string; storeName: string; storeLogo?: string; storeInfo?: { phone?: string; address?: string; capital?: string };
  customer: any; items: any[]; subtotal: number; discountPct: number;
  total: number; paymentType: string; installment: any; currency: string; discountAmt: number; printerName?: string;
}) {
  const { invoiceNumber, storeName, storeLogo, storeInfo, customer, items, subtotal, discountPct, total, paymentType, installment, currency, discountAmt, printerName } = data;
  const fmt = (n: number) => n.toLocaleString('fr-DZ') + ' ' + currency;
  const now = new Date().toLocaleString('fr-DZ');

  const html = `<!DOCTYPE html><html>
  <head><meta charset="utf-8"/>${a4Style}
  <style>
    body { padding: 12mm 15mm; font-size: 12px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; }
    .store-section h1 { font-size: 22px; color: #1e293b; margin-bottom: 2px; }
    .store-section .info { font-size: 10px; color: #64748b; line-height: 1.5; }
    .invoice-section { text-align: right; }
    .invoice-section .title { font-size: 28px; font-weight: 800; color: #4f46e5; letter-spacing: 2px; }
    .invoice-section .meta { font-size: 11px; color: #64748b; margin-top: 3px; }
    .customer-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
    .customer-box .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-bottom: 4px; }
    .customer-box .name { font-weight: 700; font-size: 14px; color: #1e293b; }
    .customer-box .detail { font-size: 11px; color: #475569; }
    table { width: 100%; border-collapse: collapse; }
    thead th { background: #f1f5f9; padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; border-bottom: 2px solid #e2e8f0; }
    thead th.r { text-align: right; }
    tbody td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #1e293b; }
    tbody td.r { text-align: right; }
    tbody td.c { text-align: center; }
    .totals-table { margin-top: 8px; margin-left: auto; width: 300px; }
    .totals-table td { padding: 5px 12px; font-size: 12px; border: none; }
    .totals-table td.r { text-align: right; }
    .totals-table .total { font-weight: 700; font-size: 18px; border-top: 2px solid #1e293b; padding-top: 8px; }
    .totals-table .total td { font-size: 18px; }
    .totals-table .total .r { color: #4f46e5; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }
    .installment-box { margin-top: 25px; padding: 18px 20px; background: linear-gradient(135deg, #faf5ff, #f3e8ff); border: 1px solid #d8b4fe; border-radius: 12px; }
    .installment-box h3 { font-size: 14px; color: #6b21a8; margin-bottom: 12px; }
    .installment-box table { width: 100%; }
    .installment-box td { padding: 4px 0; font-size: 12px; border: none; }
    .installment-box td.r { text-align: right; }
    .installment-box .hl { font-weight: 700; font-size: 16px; color: #6b21a8; }
    .footer { margin-top: 35px; padding-top: 15px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8; line-height: 1.6; }
  </style></head>
  <body dir="auto">
    <div class="header">
      <div class="store-section">
        ${storeLogo ? `<img src="${storeLogo}" style="max-width:110px;max-height:50px;margin-bottom:6px;" />` : ''}
        <h1 dir="auto">${storeName}</h1>
        <div class="info">
          ${storeInfo?.address ? `<div>${storeInfo.address}</div>` : ''}
          ${storeInfo?.phone ? `<div>Tél: ${storeInfo.phone}</div>` : ''}
          ${storeInfo?.capital ? `<div>Capital social: ${fmt(Number(storeInfo.capital))}</div>` : ''}
        </div>
      </div>
      <div class="invoice-section">
        <div class="title">FACTURE</div>
        <div class="meta">N° ${invoiceNumber}</div>
        <div class="meta">${now}</div>
      </div>
    </div>
    ${customer ? `<div class="customer-box">
      <div class="label">Facturé à</div>
      <div class="name" dir="auto">${customer.name}</div>
      ${customer.phone ? `<div class="detail">Tél: ${customer.phone}</div>` : ''}
      ${customer.address ? `<div class="detail">${customer.address}</div>` : ''}
    </div>` : ''}
    <hr class="divider" />
    <table>
      <thead><tr><th style="width:40%">Produit</th><th class="c">Qté</th><th class="r">P.U.</th><th class="r">Remise</th><th class="r">Total</th></tr></thead>
      <tbody>
        ${items.map((i: any) => `<tr>
          <td>${i.name}</td>
          <td class="c">${i.quantity}</td>
          <td class="r">${fmt(i.unitPrice)}</td>
          <td class="r">${i.discount > 0 ? i.discount + '%' : '-'}</td>
          <td class="r">${fmt(i.subtotal)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <table class="totals-table">
      <tr><td>Sous-total</td><td class="r">${fmt(subtotal)}</td></tr>
      ${discountPct > 0 || discountAmt > 0 ? `<tr><td style="color:#dc2626;">Remise</td><td class="r" style="color:#dc2626;">− ${fmt(discountAmt)}</td></tr>` : ''}
      <tr class="total"><td>TOTAL ${paymentType === 'credit' ? '(Crédit)' : ''}</td><td class="r">${fmt(total)}</td></tr>
    </table>
    ${installment ? `
    <div class="installment-box">
      <h3>Conditions de crédit</h3>
      <table>
        <tr><td>Montant total du crédit</td><td class="r"><strong>${fmt(installment.total)}</strong></td></tr>
        <tr><td>Avance initiale</td><td class="r">${fmt(installment.advance)}</td></tr>
        <tr><td>Montant restant</td><td class="r">${fmt(installment.remaining)}</td></tr>
        <tr><td>Durée</td><td class="r">${installment.months} mois</td></tr>
        <tr class="hl"><td>Mensualité</td><td class="r">${fmt(installment.monthly)}</td></tr>
      </table>
    </div>` : ''}
    <div class="footer">
      Document généré le ${now} &mdash; ${storeName} &mdash; Merci de votre confiance !
    </div>
  </body></html>`;
  openPrintWindow(html, printerName);
}

export function printPurchaseInvoice(data: {
  purchaseId: number; storeName: string; storeLogo?: string; storeInfo?: { phone?: string; address?: string };
  supplier: any; items: any[]; total: number; notes?: string; currency: string; date: string; printerName?: string;
}) {
  const { purchaseId, storeName, storeLogo, storeInfo, supplier, items, total, notes, currency, date, printerName } = data;
  const fmt = (n: number) => n.toLocaleString('fr-DZ') + ' ' + currency;

  const html = `<!DOCTYPE html><html>
  <head><meta charset="utf-8"/>${a4Style}
  <style>
    body { padding: 12mm 15mm; font-size: 12px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; }
    .store-section h1 { font-size: 22px; color: #1e293b; margin-bottom: 2px; }
    .store-section .info { font-size: 10px; color: #64748b; line-height: 1.5; }
    .doc-section { text-align: right; }
    .doc-section .title { font-size: 26px; font-weight: 800; color: #059669; letter-spacing: 1px; }
    .doc-section .meta { font-size: 11px; color: #64748b; margin-top: 3px; }
    .supplier-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
    .supplier-box .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #86efac; margin-bottom: 4px; }
    .supplier-box .name { font-weight: 700; font-size: 14px; color: #166534; }
    .supplier-box .detail { font-size: 11px; color: #15803d; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f1f5f9; padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; border-bottom: 2px solid #e2e8f0; }
    th.r { text-align: right; }
    th.c { text-align: center; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #1e293b; }
    td.r { text-align: right; }
    td.c { text-align: center; }
    .totals-table { margin-top: 8px; margin-left: auto; width: 300px; }
    .totals-table td { padding: 5px 12px; border: none; }
    .totals-table td.r { text-align: right; }
    .totals-table .gt { font-weight: 700; font-size: 18px; border-top: 2px solid #1e293b; padding-top: 8px; color: #059669; }
    .notes-box { margin-top: 20px; padding: 12px 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; font-size: 11px; color: #92400e; }
    .footer { margin-top: 35px; padding-top: 15px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8; }
  </style></head>
  <body dir="auto">
    <div class="header">
      <div class="store-section">
        ${storeLogo ? `<img src="${storeLogo}" style="max-width:110px;max-height:50px;margin-bottom:4px;" />` : ''}
        <h1 dir="auto">${storeName}</h1>
        <div class="info">
          ${storeInfo?.address ? `<div>${storeInfo.address}</div>` : ''}
          ${storeInfo?.phone ? `<div>Tél: ${storeInfo.phone}</div>` : ''}
        </div>
      </div>
      <div class="doc-section">
        <div class="title">BON D'ACHAT</div>
        <div class="meta">N° ${purchaseId}</div>
        <div class="meta">${date}</div>
      </div>
    </div>
    ${supplier ? `<div class="supplier-box">
      <div class="label">Fournisseur</div>
      <div class="name">${supplier.name}</div>
      ${supplier.phone ? `<div class="detail">Tél: ${supplier.phone}</div>` : ''}
      ${supplier.address ? `<div class="detail">${supplier.address}</div>` : ''}
    </div>` : ''}
    <table>
      <thead><tr><th style="width:50%">Produit</th><th class="c">Qté</th><th class="r">Prix achat</th><th class="r">Total</th></tr></thead>
      <tbody>
        ${items.map((i: any) => `<tr>
          <td>${i.name}</td>
          <td class="c">${i.quantity}</td>
          <td class="r">${fmt(i.cost_price)}</td>
          <td class="r">${fmt(i.subtotal)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <table class="totals-table">
      <tr class="gt"><td>TOTAL</td><td class="r">${fmt(total)}</td></tr>
    </table>
    ${notes ? `<div class="notes-box"><strong>Notes:</strong> ${notes}</div>` : ''}
    <div class="footer">
      Document généré le ${date} &mdash; ${storeName}
    </div>
  </body></html>`;
  openPrintWindow(html, printerName);
}

export function printInstallmentContract(data: {
  storeName: string; storeLogo?: string; customer: any; installment: any;
  items: any[]; invoiceNumber: string; currency: string; printerName?: string;
}) {
  const { storeName, storeLogo, customer, installment, items, invoiceNumber, currency } = data;
  const fmt = (n: number) => n.toLocaleString('fr-DZ') + ' ' + currency;
  const now = new Date().toLocaleDateString('fr-DZ');

  const schedule = Array.from({ length: installment.months }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() + i + 1);
    return { month: i + 1, date: d.toLocaleDateString('fr-DZ'), amount: installment.monthly };
  });

  const html = `<!DOCTYPE html><html>
  <head><meta charset="utf-8"/>${a4Style}
  <style>
    body { padding: 15mm 18mm; font-size: 12px; }
    h1 { font-size: 20px; text-align: center; color: #1e293b; letter-spacing: 1px; }
    .doc-meta { text-align: center; color: #64748b; font-size: 11px; margin-bottom: 20px; }
    .section { margin: 18px 0; }
    .section h3 { color: #4f46e5; font-size: 13px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    .customer-info { padding: 10px 14px; background: #f8fafc; border-radius: 6px; }
    .customer-info .name { font-weight: 700; font-size: 14px; color: #1e293b; }
    .customer-info .detail { font-size: 11px; color: #475569; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f1f5f9; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; border-bottom: 2px solid #e2e8f0; }
    th.r { text-align: right; }
    th.c { text-align: center; }
    td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #1e293b; }
    td.r { text-align: right; }
    td.c { text-align: center; }
    .fin-table td { padding: 5px 10px; border: none; font-size: 12px; }
    .fin-table .hl td { font-size: 16px; font-weight: 700; color: #4f46e5; padding-top: 8px; border-top: 2px solid #1e293b; }
    .schedule-table td:last-child { width: 50px; border-bottom: 1px solid #cbd5e1; }
    .sig { display: flex; justify-content: space-between; margin-top: 50px; }
    .sig-box { width: 38%; border-top: 2px solid #1e293b; padding-top: 8px; text-align: center; font-size: 11px; color: #475569; }
  </style></head>
  <body dir="auto">
    ${storeLogo ? `<div class="c" style="text-align:center;margin-bottom:8px;"><img src="${storeLogo}" style="max-width:100px;max-height:45px;" /></div>` : ''}
    <h1>CONTRAT DE VENTE À CRÉDIT</h1>
    <div class="doc-meta" dir="auto">${storeName} — N° ${invoiceNumber} — ${now}</div>

    <div class="section">
      <h3>Client</h3>
      <div class="customer-info">
        <div class="name">${customer?.name || 'N/A'}</div>
        ${customer?.phone ? `<div class="detail">Tél: ${customer.phone}</div>` : ''}
        ${customer?.address ? `<div class="detail">Adresse: ${customer.address}</div>` : ''}
      </div>
    </div>

    <div class="section">
      <h3>Produits</h3>
      <table>
        <thead><tr><th style="width:45%">Produit</th><th class="c">Qté</th><th class="r">Prix</th><th class="r">Total</th></tr></thead>
        <tbody>${items.map(i => `<tr><td>${i.name}</td><td class="c">${i.quantity}</td><td class="r">${fmt(i.unitPrice)}</td><td class="r">${fmt(i.subtotal)}</td></tr>`).join('')}</tbody>
      </table>
    </div>

    <div class="section">
      <h3>Conditions financières</h3>
      <table class="fin-table">
        <tr><td style="width:70%">Prix total</td><td class="r"><strong>${fmt(installment.total_amount)}</strong></td></tr>
        <tr><td>Avance initiale</td><td class="r">${fmt(installment.advance)}</td></tr>
        <tr><td>Montant à financer</td><td class="r">${fmt(installment.remaining)}</td></tr>
        <tr><td>Durée</td><td class="r"><strong>${installment.months} mois</strong></td></tr>
        <tr class="hl"><td>Mensualité</td><td class="r">${fmt(installment.monthly_payment)}</td></tr>
      </table>
    </div>

    <div class="section">
      <h3>Échéancier</h3>
      <table>
        <thead><tr><th class="c">N°</th><th>Date</th><th class="r">Montant</th><th></th></tr></thead>
        <tbody>${schedule.map(s => `<tr><td class="c">${s.month}</td><td>${s.date}</td><td class="r">${fmt(s.amount)}</td><td style="width:50px;border-bottom:1px solid #cbd5e1"></td></tr>`).join('')}</tbody>
      </table>
    </div>

    <div class="sig">
      <div class="sig-box">Signature Vendeur</div>
      <div class="sig-box">Signature Client<br><span style="color:#94a3b8;font-size:10px;">Lu et approuvé</span></div>
    </div>
  </body></html>`;
  openPrintWindow(html);
}

// ─── ESC/POS raw printing (bypasses driver, works on Xprinter thermal) ─────────

const cp850: Record<string, number> = {
  'à': 0x84, 'â': 0x83, 'ä': 0x84, 'é': 0x82, 'è': 0x8A, 'ê': 0x8A, 'ë': 0x8B,
  'î': 0x8C, 'ï': 0x8D, 'ô': 0x93, 'ö': 0x94, 'ù': 0x97, 'û': 0x96, 'ü': 0x81,
  'ç': 0x87, 'Ç': 0x80, 'É': 0x90, 'È': 0x8A, 'À': 0xB7, 'Ô': 0x93,
  '€': 0xD5, '°': 0xF8, '²': 0xFD,
};


function toBytes(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c < 128) { out.push(c); continue; }
    const mapped = cp850[ch];
    out.push(mapped ?? 0x3F);
  }
  return out;
}

function padRight(s: string, w: number): string {
  return s.padEnd(w);
}

function padLeft(s: string, w: number): string {
  return s.padStart(w);
}

function div32(bytes: number[]) {
  bytes.push(...toBytes('-'.repeat(32)));
  bytes.push(0x0A);
}

function eq32(bytes: number[]) {
  bytes.push(...toBytes('='.repeat(32)));
  bytes.push(0x0A);
}

function initPrinter(bytes: number[]) {
  bytes.push(0x1B, 0x40);
  bytes.push(0x1B, 0x74, 0x02);
}

function center(bytes: number[]) {
  bytes.push(0x1B, 0x61, 0x01);
}

function left(bytes: number[]) {
  bytes.push(0x1B, 0x61, 0x00);
}

function writeln(bytes: number[], s: string) {
  bytes.push(...toBytes(s));
  bytes.push(0x0A);
}

function barcode128(bytes: number[], data: string, height?: number, width?: number, hri?: number) {
  const d = toBytes(data);
  if (d.length < 2 || d.length > 255) return;
  bytes.push(0x1D, 0x68, height ?? 0x60);  // height (default 96 dots)
  bytes.push(0x1D, 0x77, width ?? 0x02);   // module width (default 2 dots)
  bytes.push(0x1D, 0x48, hri ?? 0x02);     // HRI position (0=none,1=above,2=below)
  center(bytes);
  bytes.push(0x1D, 0x6B, 0x49, d.length, ...d);
  bytes.push(0x0A);
}

function sendRaw(printerName: string, bytes: number[]) {
  const hex = bytes.map(b => '0x' + b.toString(16).padStart(2, '0')).join(',');
  (window as any).electronAPI.printRaw(printerName, hex);
}

function fmtMoney(n: number, currency: string) {
  return n.toLocaleString('fr-DZ') + ' ' + currency;
}

function paymentLabel(paymentType: string, installment: any): string {
  if (installment) return 'CREDIT';
  if (paymentType === 'cash') return 'Especes';
  if (paymentType === 'card') return 'Carte';
  return 'Credit';
}

function writeItemRow(bytes: number[], name: string, qty: number, price: number, total: number) {
  const n = name.length > 14 ? name.substring(0, 14) + '.' : name;
  const q = String(qty);
  const p = price.toLocaleString('fr-DZ');
  const t = total.toLocaleString('fr-DZ');
  writeln(bytes, padRight(n, 14) + ' ' + padLeft(q, 3) + ' ' + padLeft(p, 6) + ' ' + padLeft(t, 7));
}

function writeItems(bytes: number[], items: any[]) {
  writeln(bytes, padRight('Produit', 16) + padLeft('Qte', 4) + padLeft('PU', 6) + padLeft('Total', 7));
  div32(bytes);
  for (const i of items) {
    writeItemRow(bytes, i.name, i.quantity, i.unitPrice, i.subtotal);
  }
}

function writeTotals(bytes: number[], subtotal: number, discountPct: number, total: number, currency: string) {
  div32(bytes);
  writeln(bytes, padLeft('Sous-total', 22) + '  ' + fmtMoney(subtotal, currency));
  if (discountPct > 0) {
    const discAmt = subtotal * discountPct / 100;
    writeln(bytes, padLeft('Remise ' + discountPct + '%', 22) + '  ' + padLeft('-' + fmtMoney(discAmt, currency), 10));
  }
  eq32(bytes);
  center(bytes);
  writeln(bytes, 'TOTAL: ' + fmtMoney(total, currency));
  left(bytes);
}

function writeInstallment(bytes: number[], inst: any, currency: string) {
  div32(bytes);
  center(bytes);
  writeln(bytes, '--- CREDIT ---');
  left(bytes);
  writeln(bytes, 'Total credit: ' + fmtMoney(inst.total, currency));
  writeln(bytes, 'Avance:      ' + fmtMoney(inst.advance, currency));
  writeln(bytes, 'Restant:     ' + fmtMoney(inst.remaining, currency));
  writeln(bytes, inst.months + ' mois x    ' + fmtMoney(inst.monthly, currency));
}

function fmtDate() {
  return new Date().toLocaleString('fr-DZ');
}

// ─── Thermal Receipt ───────────────────────────────────────────────────────────

export function printThermalReceiptRaw(data: {
  invoiceNumber: string; storeName: string; storeLogo?: string; storeInfo?: { phone?: string; address?: string }; customer: any;
  items: any[]; subtotal: number; discountPct: number;
  total: number; paymentType: string; installment: any; currency: string; printerName?: string;
}) {
  const { invoiceNumber, storeName, storeInfo, customer, items, subtotal, discountPct, total, paymentType, installment, currency, printerName } = data;
  if (!printerName) { printThermalReceipt(data); return; }

  const b: number[] = [];
  initPrinter(b);

  center(b); writeln(b, storeName);
  if (storeInfo?.phone) { left(b); writeln(b, storeInfo.phone); center(b); }
  eq32(b);
  center(b); writeln(b, 'TICKET DE CAISSE'); writeln(b, '');
  left(b); writeln(b, 'N: ' + invoiceNumber); writeln(b, 'Date: ' + fmtDate());

  if (customer) {
    div32(b);
    writeln(b, 'Client: ' + customer.name);
    if (customer.phone) writeln(b, 'Tel: ' + customer.phone);
  }

  writeItems(b, items);
  writeTotals(b, subtotal, discountPct, total, currency);

  if (installment) writeInstallment(b, installment, currency);
  else writeln(b, 'Paiement: ' + paymentLabel(paymentType, installment));

  b.push(0x0A);
  center(b); writeln(b, 'Merci de votre visite !');
  barcode128(b, invoiceNumber);
  b.push(0x1D, 0x56, 0x42, 0x00);

  sendRaw(printerName, b);
}

// ─── Proforma Invoice (ESC/POS) ────────────────────────────────────────────────

export function printProformaInvoiceRaw(data: {
  storeName: string; storeLogo?: string; storeInfo?: { phone?: string; address?: string }; customer: any; items: any[];
  subtotal: number; discount: number; total: number;
  paymentType: string; installment: any; currency: string; printerName?: string;
}) {
  const { storeName, storeInfo, customer, items, subtotal, discount, total, paymentType, installment, currency, printerName } = data;
  if (!printerName) { printProformaInvoice(data); return; }

  const b: number[] = [];
  initPrinter(b);

  center(b); writeln(b, storeName);
  if (storeInfo?.phone) { left(b); writeln(b, storeInfo.phone); center(b); }
  eq32(b);
  center(b); writeln(b, 'FACTURE PROFORMA'); writeln(b, '');

  left(b);
  if (customer) {
    writeln(b, 'Client: ' + customer.name);
    if (customer.phone) writeln(b, 'Tel: ' + customer.phone);
  }
  div32(b);
  writeln(b, 'Date: ' + fmtDate());

  writeItems(b, items);
  writeTotals(b, subtotal, discount, total, currency);

  if (installment) writeInstallment(b, installment, currency);
  else writeln(b, 'Paiement: ' + paymentLabel(paymentType, installment));

  b.push(0x0A);
  center(b); writeln(b, 'Document non contractuel');
  writeln(b, 'Devis valable 7 jours');
  barcode128(b, String(Date.now()));
  b.push(0x1D, 0x56, 0x42, 0x00);

  sendRaw(printerName, b);
}

// ─── Detailed Invoice (ESC/POS) ────────────────────────────────────────────────

export function printDetailedInvoiceRaw(data: {
  invoiceNumber: string; storeName: string; storeLogo?: string; storeInfo?: { phone?: string; address?: string; capital?: string };
  customer: any; items: any[]; subtotal: number; discountPct: number;
  total: number; paymentType: string; installment: any; currency: string; discountAmt: number; printerName?: string;
}) {
  const { invoiceNumber, storeName, storeInfo, customer, items, subtotal, discountPct, total, paymentType, installment, currency, discountAmt, printerName } = data;
  if (!printerName) { printDetailedInvoice(data); return; }

  const b: number[] = [];
  initPrinter(b);

  center(b); writeln(b, storeName);
  if (storeInfo?.address) { left(b); writeln(b, storeInfo.address); center(b); }
  eq32(b);
  center(b); writeln(b, 'FACTURE'); writeln(b, '');

  left(b); writeln(b, 'N: ' + invoiceNumber); writeln(b, 'Date: ' + fmtDate());

  if (customer) {
    div32(b);
    writeln(b, 'Client: ' + customer.name);
    if (customer.phone) writeln(b, 'Tel: ' + customer.phone);
    if (customer.address) writeln(b, 'Adresse: ' + customer.address);
  }

  writeItems(b, items);
  writeTotals(b, subtotal, discountPct, total, currency);

  if (discountAmt > 0) {
  }

  if (installment) writeInstallment(b, installment, currency);
  else writeln(b, 'Paiement: ' + paymentLabel(paymentType, installment));

  b.push(0x0A);
  center(b); writeln(b, 'Merci de votre confiance !');
  barcode128(b, invoiceNumber);
  b.push(0x1D, 0x56, 0x42, 0x00);

  sendRaw(printerName, b);
}

// ─── Barcode Label (TSPL) — rotated 90° ─────────────────────────────────────────
// All elements drawn with (X,Y) coordinates on ONE label canvas, one PRINT at end.
// Barcode rotated 90° so bars run horizontally (vertical barcode on the label).
// Price text to the right of the barcode.

export function printBarcodeLabelTSPL(data: {
  barcodeValue: string;
  price: number;
  currency: string;
  printerName?: string;
  labelHeightMm?: number;
  count?: number;
}) {
  const { barcodeValue, price, currency, printerName, labelHeightMm = 15, count = 1 } = data;
  if (!printerName) return;

  const crlf = '\r\n';
  const h = Math.max(labelHeightMm, 10);

  const tspl =
    `SIZE 58 mm, ${h} mm${crlf}` +
    `GAP 3 mm${crlf}` +
    `DIRECTION 0${crlf}` +
    `CLS${crlf}` +
    `BARCODE 10,5,"128",30,0,1,2,2,"${barcodeValue}"${crlf}` +
    `TEXT 50,45,"1",0,2,2,"${price.toLocaleString('fr-DZ')} ${currency}"${crlf}` +
    `TEXT 50,75,"1",0,1,1,"${barcodeValue}"${crlf}` +
    `PRINT ${count}${crlf}`;

  const bytes = Array.from(new TextEncoder().encode(tspl));
  const hex = bytes.map(b => '0x' + b.toString(16).padStart(2, '0')).join(',');
  (window as any).electronAPI.printRaw(printerName, hex);
}
