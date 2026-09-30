// Email templates in the vintage style (Section 12): cream background,
// maroon "Talkies" header in a serif font (Georgia is email-safe), simple layout.
// Every template returns { subject, html, text }.

// User text (like a name) must never become HTML in an email
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function layout(bodyHtml) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#F3E9D2;color:#3B2A20;font-family:'Courier New',monospace;">
    <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;border:1px solid #3B2A20;border-radius:8px;background:#F3E9D2;">
      <tr>
        <td style="background:#7B1E1E;color:#D9A441;padding:16px 24px;border-radius:8px 8px 0 0;font-family:Georgia,serif;font-size:28px;">Talkies</td>
      </tr>
      <tr>
        <td style="padding:24px;font-size:16px;line-height:1.5;">${bodyHtml}</td>
      </tr>
    </table>
  </body>
</html>`
}

function button(link, label) {
  return `<p style="margin:24px 0;"><a href="${escapeHtml(link)}" style="background:#7B1E1E;color:#F3E9D2;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">${escapeHtml(label)}</a></p>`
}

// E-01: verify email link (U-01, O-01)
export function verifyEmailTemplate({ name, link, hours }) {
  const subject = 'Talkies – please verify your email'
  const html = layout(`
    <p>Namaste ${escapeHtml(name)},</p>
    <p>Welcome to Talkies! Please verify your email to start booking your seats.</p>
    ${button(link, 'Verify my email')}
    <p>This link works for ${hours} hours. If you did not sign up, you can ignore this email.</p>
    <p style="font-size:13px;">If the button does not work, open this link:<br>${escapeHtml(link)}</p>`)
  const text = `Namaste ${name},

Welcome to Talkies! Please verify your email to start booking your seats.

Verify my email: ${link}

This link works for ${hours} hours. If you did not sign up, you can ignore this email.`
  return { subject, html, text }
}
