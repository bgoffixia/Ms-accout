import type { StaffEmailBranding } from "@workspace/db";

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

function readableTextColor(hex: string): string {
  const channels = hex.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (!channels) return "#ffffff";
  const luminance = channels.slice(1).map((channel) => {
    const value = parseInt(channel!, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
  return luminance > 0.225 ? "#102b46" : "#ffffff";
}

export function renderStaffEmailText(input: {
  messageText: string;
  branding: StaffEmailBranding;
}): string {
  const footerLink = input.branding.footerLinkUrl?.startsWith("https://")
    ? `${input.branding.footerLinkText.trim() || input.branding.footerLinkUrl}: ${input.branding.footerLinkUrl}`
    : "";
  const footer = [
    input.branding.senderName,
    input.branding.footerText,
    footerLink,
  ].filter((part) => part.trim());
  return `${input.messageText}${footer.length ? `\n\n${footer.join("\n")}` : ""}`;
}

export function renderStaffEmailHtml(input: {
  subject: string;
  messageText: string;
  branding: StaffEmailBranding;
}): string {
  const subject = escapeHtml(input.subject);
  const message = renderMessageText(input.messageText);
  const branding = input.branding;
  const senderName = escapeHtml(branding.senderName);
  const accentColor = /^#[\da-f]{6}$/i.test(branding.accentColor)
    ? branding.accentColor
    : "#49b8aa";
  const headerColor = /^#[\da-f]{6}$/i.test(branding.headerColor)
    ? branding.headerColor
    : "#102b46";
  const headerTextColor = readableTextColor(headerColor);
  const safeLogoUrl = branding.logoUrl?.startsWith("https://")
    ? escapeHtml(branding.logoUrl)
    : null;
  const footerText = escapeHtml(branding.footerText);
  const safeFooterLinkUrl = branding.footerLinkUrl?.startsWith("https://")
    ? escapeHtml(branding.footerLinkUrl)
    : null;
  const footerLink = safeFooterLinkUrl && branding.footerLinkText.trim()
    ? `<a href="${safeFooterLinkUrl}" style="display:inline-block;margin-top:8px;padding:7px 13px;border-radius:999px;background:${accentColor};color:${readableTextColor(accentColor)};font-size:11px;font-weight:700;text-decoration:none">${escapeHtml(branding.footerLinkText.trim())}</a>`
    : "";
  const logo = safeLogoUrl
    ? `<img src="${safeLogoUrl}" width="140" height="44" alt="${senderName}" style="display:block;width:auto;max-width:140px;height:auto;max-height:44px;border:0;object-fit:contain" />`
    : `<span style="display:inline-block;width:42px;height:42px;line-height:42px;border-radius:9px;background:#eaf5f5;color:#16445e;text-align:center;font-size:15px;font-weight:700;letter-spacing:1px">SV</span>`;

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
              <td style="padding:0 0 4px;background:${accentColor};font-size:0;line-height:0">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:22px 28px;background:${headerColor}">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="left" valign="middle" style="max-width:140px;vertical-align:middle">${logo}</td>
                    <td style="padding-left:13px">
                      <div style="color:${headerTextColor};font-size:17px;font-weight:700;line-height:1.3;overflow-wrap:anywhere">${senderName}</div>
                      <div style="padding-top:4px;color:${headerTextColor};font-size:10px;font-weight:700;letter-spacing:1.7px;line-height:1.4">ENROLLMENT PORTAL</div>
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
                ${senderName}${footerText ? ` · ${footerText}` : ""}<br />
                ${footerLink}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
