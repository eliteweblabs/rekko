import { escHtml } from './escHtml';

export function fmtDateLong(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
}

/** Inline-styled signature block + audit table baked into signed artifacts. */
export function buildSignatureBlock(opts: {
  docId: string;
  signerName: string;
  signedAt: string;
  consentAt: string;
  ip: string;
  userAgent: string;
  contentHash: string;
  companyName: string;
}): string {
  const { docId, signerName, signedAt, consentAt, ip, userAgent, contentHash, companyName } = opts;
  const dateStr = fmtDateLong(signedAt);

  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:3px 16px 3px 0;font-weight:600;white-space:nowrap;width:1%;vertical-align:top">${escHtml(label)}</td>
      <td style="padding:3px 0;word-break:break-all">${escHtml(value)}</td>
    </tr>`;

  return `
<!-- begin:esignature -->
<div style="margin-top:48px;page-break-inside:avoid;font-family:'Inter',-apple-system,BlinkMacSystemFont,Georgia,serif">
  <div style="height:1px;background:#1a1a1a;margin-bottom:28px"></div>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap">
    <div style="flex:1;min-width:200px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#888;margin-bottom:6px">Electronically signed by</div>
      <div style="font-size:21px;font-style:italic;font-weight:600;border-bottom:1px solid #ccc;padding-bottom:6px;margin-bottom:8px;font-family:Georgia,'Times New Roman',serif">${escHtml(signerName)}</div>
      <div style="font-size:13px;color:#555">${escHtml(dateStr)}</div>
    </div>
    <div style="width:100px;height:100px;border:2.5px solid #166534;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:0 0 auto;transform:rotate(-12deg)">
      <div style="text-align:center;line-height:1.4">
        <div style="font-weight:800;font-size:13px;color:#166534;letter-spacing:2px">SIGNED</div>
        <div style="font-size:10px;color:#166534;letter-spacing:1px">via ${escHtml(companyName)}</div>
      </div>
    </div>
  </div>
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#aaa;margin-bottom:10px;font-weight:600">Electronic Signature Audit Record</div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;color:#777;font-family:ui-monospace,'Cascadia Code',monospace">
      ${row('Document ID', docId)}
      ${row('Signed at (UTC)', fmtDateLong(signedAt))}
      ${row('Consent at (UTC)', fmtDateLong(consentAt))}
      ${row('IP address', ip)}
      ${row('User agent', userAgent.slice(0, 200))}
      ${row('Content hash (SHA-256)', contentHash)}
    </table>
  </div>
</div>
<!-- end:esignature -->`.trim();
}
