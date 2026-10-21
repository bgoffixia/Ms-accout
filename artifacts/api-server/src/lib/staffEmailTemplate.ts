function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function renderMessageText(messageText: string): string {
  const linkedText = messageText.split(/(https:\/\/[^\s<>"']+)/g).map((part) => {
    if (!part.startsWith("https://")) return escapeHtml(part);

    const trailingPunctuation = part.match(/[),.!?:;]+$/)?.[0] ?? "";
    const url = trailingPunctuation
      ? part.slice(0, -trailingPunctuation.length)
      : part;
    const safeUrl = escapeHtml(url);
    return `<a href="${safeUrl}" style="color:#176b86;text-decoration:underline;word-break:break-word">${safeUrl}</a>${escapeHtml(trailingPunctuation)}`;
  }).join("");

  return linkedText.replace(/\r\n|\r|\n/g, "<br />");
}

export function renderStaffEmailHtml(input: {
  subject: string;
  messageText: string;
}): string {
  const subject = escapeHtml(input.subject);
  const message = renderMessageText(input.messageText);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f8;color:#203449;font-family:Arial,Helvetica,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">
      A message from the Security Verification Enrollment Portal team.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f1f5f8">
      <tr>
        <td align="center" style="padding:32px 14px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px">
            <tr>
              <td style="padding:0 0 4px;background:#49b8aa;font-size:0;line-height:0">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:22px 28px;background:#102b46">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="42" height="42" align="center" valign="middle" style="width:42px;height:42px;border-radius:9px;background:#eaf5f5;color:#16445e;font-size:15px;font-weight:700;letter-spacing:1px">SV</td>
                    <td style="padding-left:13px">
                      <div style="color:#ffffff;font-size:17px;font-weight:700;line-height:1.3">Security Verification</div>
                      <div style="padding-top:4px;color:#c5d6e2;font-size:10px;font-weight:700;letter-spacing:1.7px;line-height:1.4">ENROLLMENT PORTAL</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 32px 34px;background:#ffffff;border:1px solid #dce5eb;border-top:0">
                <div style="margin-bottom:13px;color:#287d8b;font-size:10px;font-weight:700;letter-spacing:1.5px;line-height:1.4">STAFF MESSAGE</div>
                <h1 style="margin:0 0 20px;color:#152f48;font-family:Georgia,'Times New Roman',serif;font-size:25px;font-weight:600;line-height:1.25">${subject}</h1>
                <div style="color:#45596a;font-size:15px;line-height:1.75;overflow-wrap:anywhere">${message}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 20px 0;color:#738392;font-size:11px;line-height:1.6;text-align:center">
                Security Verification Enrollment Portal · Staff communications
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
