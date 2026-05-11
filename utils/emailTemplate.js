const BRAND = {
  name: "Portfolio",
  tagline: "Professional portfolio builder",
  logoUrl:
    process.env.BRAND_LOGO_URL ||
    "https://portfoliopro-nu.vercel.app/assets/logo-portfolio.png",
  siteUrl: process.env.BRAND_SITE_URL || "https://portfoliopro-nu.vercel.app",
  accent: "#a855f7",
  accentSoft: "#6366f1",
  bg: "#f5f3ff",
  cardBg: "#ffffff",
  text: "#0b0a18",
  textSoft: "#4b5563",
  textMuted: "#94a3b8",
  border: "#e5e7eb",
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderEmail = ({ preheader = "", title, intro, bodyHtml, footerNote }) => `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.bg};font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.text};">
    <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${BRAND.bg};">${escapeHtml(preheader)}</div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BRAND.bg};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:${BRAND.cardBg};border-radius:16px;overflow:hidden;box-shadow:0 12px 40px -20px rgba(15,12,41,0.25);">
            <tr>
              <td style="background:linear-gradient(135deg,${BRAND.accent} 0%,${BRAND.accentSoft} 100%);padding:28px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td valign="middle" style="font-size:0;">
                      <a href="${BRAND.siteUrl}" style="display:inline-block;text-decoration:none;vertical-align:middle;">
                        <img
                          src="${BRAND.logoUrl}"
                          alt="${escapeHtml(BRAND.name)}"
                          width="40"
                          height="40"
                          style="display:inline-block;vertical-align:middle;width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,0.18);border:0;outline:none;text-decoration:none;"
                        />
                      </a>
                      <a href="${BRAND.siteUrl}" style="display:inline-block;margin-left:12px;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.02em;text-decoration:none;vertical-align:middle;">${escapeHtml(BRAND.name)}</a>
                    </td>
                    <td align="right" valign="middle" style="color:rgba(255,255,255,0.78);font-size:11px;text-transform:uppercase;letter-spacing:0.16em;font-weight:600;">${escapeHtml(BRAND.tagline)}</td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:36px 36px 12px;">
                <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${BRAND.text};font-weight:700;letter-spacing:-0.01em;">${escapeHtml(title)}</h1>
                ${intro ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${BRAND.textSoft};">${intro}</p>` : ""}
              </td>
            </tr>

            <tr>
              <td style="padding:0 36px 28px;">
                ${bodyHtml}
              </td>
            </tr>

            <tr>
              <td style="padding:20px 36px 28px;border-top:1px solid ${BRAND.border};background:#fafafa;">
                <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:${BRAND.textMuted};">${footerNote || "You're receiving this email because of activity on your " + BRAND.name + " account."}</p>
                <p style="margin:0;font-size:11px;color:${BRAND.textMuted};">© ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.</p>
              </td>
            </tr>
          </table>

          <p style="margin:18px 0 0;font-size:11px;color:${BRAND.textMuted};">This is an automated message — please do not reply.</p>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

module.exports = { renderEmail, escapeHtml, BRAND };
