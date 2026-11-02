import { escHtml } from './escHtml';

export type CraterEstimateSignPayload = {
  customer: { name?: string | null };
  company: { name?: string | null };
  estimate: {
    estimate_number: string;
    estimate_date?: string | null;
    expiry_date?: string | null;
    status: string;
    total: number;
    notes?: string | null;
    items: Array<{
      name: string;
      description?: string | null;
      quantity: number;
      price: number;
      total: number;
    }>;
  };
  urls?: { pdf?: string | null };
};

function money(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

/** HTML body presented to the signer (pre-signature-block hash input). */
export function renderEstimateSignHtml(payload: CraterEstimateSignPayload): string {
  const est = payload.estimate;
  const companyName = payload.company?.name ?? 'Company';
  const clientName = payload.customer?.name ?? 'Client';

  const rows = est.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:10px 8px;border-bottom:1px solid #eee">${escHtml(item.name)}${
            item.description
              ? `<div style="font-size:12px;color:#666;margin-top:4px">${escHtml(item.description)}</div>`
              : ''
          }</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right">${escHtml(String(item.quantity))}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right">${escHtml(money(item.price))}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600">${escHtml(money(item.total))}</td>
        </tr>`,
    )
    .join('');

  const notes = est.notes?.trim()
    ? `<h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.5px;margin:32px 0 8px">Notes</h2>
       <p style="margin:0;color:#333">${escHtml(est.notes.trim())}</p>`
    : '';

  const pdfLink = payload.urls?.pdf
    ? `<p style="font-size:13px;color:#666;margin:0 0 24px">Detailed PDF: <a href="${escHtml(payload.urls.pdf)}" style="color:#1a1a1a">${escHtml(payload.urls.pdf)}</a></p>`
    : '';

  return `
<div class="estimate-sign-doc">
  <h1 style="font-size:28px;font-weight:800;margin:0 0 6px">Estimate ${escHtml(est.estimate_number)}</h1>
  <p class="doc-meta" style="font-size:14px;color:#888;margin:0 0 32px;padding-bottom:24px;border-bottom:1px solid #eee">
    Prepared by ${escHtml(companyName)} for ${escHtml(clientName)}
    ${est.estimate_date ? ` · Date ${escHtml(est.estimate_date)}` : ''}
    ${est.expiry_date ? ` · Valid through ${escHtml(est.expiry_date)}` : ''}
  </p>
  ${pdfLink}
  <p style="margin:0 0 20px;color:#333">
    By signing below, you agree to the scope and pricing in this estimate and authorize ${escHtml(companyName)} to proceed on that basis.
  </p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px">
    <thead>
      <tr style="text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#888">
        <th style="padding:8px;border-bottom:2px solid #1a1a1a">Item</th>
        <th style="padding:8px;border-bottom:2px solid #1a1a1a;text-align:right">Qty</th>
        <th style="padding:8px;border-bottom:2px solid #1a1a1a;text-align:right">Rate</th>
        <th style="padding:8px;border-bottom:2px solid #1a1a1a;text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="3" style="padding:16px 8px 0;text-align:right;font-weight:700">Total</td>
        <td style="padding:16px 8px 0;text-align:right;font-weight:800;font-size:18px">${escHtml(money(est.total))}</td>
      </tr>
    </tfoot>
  </table>
  ${notes}
</div>`.trim();
}
