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

// E-02: password reset link (U-03)
export function resetPasswordTemplate({ name, link, minutes }) {
  const subject = 'Talkies – reset your password'
  const html = layout(`
    <p>Namaste ${escapeHtml(name)},</p>
    <p>We got a request to reset your Talkies password. Press the button to choose a new one.</p>
    ${button(link, 'Choose a new password')}
    <p>This link works for ${minutes} minutes and only once. After the reset, you are logged out on all devices.</p>
    <p>If you did not ask for this, you can ignore this email. Your password stays the same.</p>
    <p style="font-size:13px;">If the button does not work, open this link:<br>${escapeHtml(link)}</p>`)
  const text = `Namaste ${name},

We got a request to reset your Talkies password.

Choose a new password: ${link}

This link works for ${minutes} minutes and only once. After the reset, you are logged out on all devices.

If you did not ask for this, you can ignore this email. Your password stays the same.`
  return { subject, html, text }
}

// E-09: owner approved or rejected (A-03)
export function ownerDecisionTemplate({ name, businessName, approved, reason, link }) {
  const subject = approved ? 'Talkies – your owner account is approved' : 'Talkies – your owner account was not approved'
  const html = approved
    ? layout(`
    <p>Namaste ${escapeHtml(name)},</p>
    <p>Good news! Your owner account for <strong>${escapeHtml(businessName)}</strong> is approved.</p>
    <p>You can log in and add your theatres now. Each new theatre is checked by our team before it goes live.</p>
    ${button(link, 'Log in')}`)
    : layout(`
    <p>Namaste ${escapeHtml(name)},</p>
    <p>Sorry, your owner account for <strong>${escapeHtml(businessName)}</strong> was not approved.</p>
    <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
    <p>If you have questions, please reply to this email.</p>`)
  const text = approved
    ? `Namaste ${name},

Good news! Your owner account for ${businessName} is approved.
You can log in and add your theatres now. Each new theatre is checked by our team before it goes live.

Log in: ${link}`
    : `Namaste ${name},

Sorry, your owner account for ${businessName} was not approved.
Reason: ${reason}

If you have questions, please reply to this email.`
  return { subject, html, text }
}

// E-09: theatre approved or rejected (A-04). Sent to the owner.
export function theatreDecisionTemplate({ name, theatreName, approved, reason, link }) {
  const subject = approved ? `Talkies – ${theatreName} is approved` : `Talkies – ${theatreName} was not approved`
  const html = approved
    ? layout(`
    <p>Namaste ${escapeHtml(name)},</p>
    <p>Good news! Your theatre <strong>${escapeHtml(theatreName)}</strong> is approved.</p>
    <p>You can add screens and shows now.</p>
    ${button(link, 'Open my theatre')}`)
    : layout(`
    <p>Namaste ${escapeHtml(name)},</p>
    <p>Sorry, your theatre <strong>${escapeHtml(theatreName)}</strong> was not approved.</p>
    <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
    <p>You can fix the details and save the theatre again. It then goes back to our team.</p>
    ${button(link, 'Edit my theatre')}`)
  const text = approved
    ? `Namaste ${name},

Good news! Your theatre ${theatreName} is approved. You can add screens and shows now.

Open my theatre: ${link}`
    : `Namaste ${name},

Sorry, your theatre ${theatreName} was not approved.
Reason: ${reason}

You can fix the details and save the theatre again. It then goes back to our team.

Edit my theatre: ${link}`
  return { subject, html, text }
}

// E-03: booking confirmed (U-17). `t` = ticketDetails(booking). The QR is an attached
// picture shown inside the email (cid:, because Gmail blocks data: pictures); the
// ticket PDF and the GST invoice PDF are attached too.
export function bookingConfirmedTemplate({ name, t, link, qrCid, invoiceNumber }) {
  const subject = `Talkies – booking confirmed: ${t.movieTitle} (${t.bookingNumber})`
  const rows = [
    ['Show', t.showText],
    ['Theatre', `${t.theatreName}, ${t.theatreAddress}`],
    ['Screen', t.screenName],
    ['Class', t.classText],
    [t.admit === 1 ? 'Seat' : 'Seats', t.seatsText],
    t.foodText && ['Food', `${t.foodText}${t.pickupText ? ` (pickup: ${t.pickupText})` : ''}`],
    ['Total paid', t.totalText],
  ].filter(Boolean)
  const rowHtml = rows
    .map(([label, value]) => `<tr><td style="padding:4px 12px 4px 0;vertical-align:top;color:#7D5100;white-space:nowrap;">${escapeHtml(label)}</td><td style="padding:4px 0;">${escapeHtml(value)}</td></tr>`)
    .join('')
  const html = layout(`
    <p>Namaste ${escapeHtml(name)},</p>
    <p>Your booking is confirmed. Enjoy the show!</p>
    <div style="border:2px solid #7B1E1E;border-radius:8px;padding:16px;background:#FFFDF5;">
      <p style="margin:0;font-family:Georgia,serif;font-size:22px;color:#7B1E1E;">${escapeHtml(t.movieTitle)}</p>
      <p style="margin:4px 0 12px;font-size:14px;">${escapeHtml(t.movieInfo)} · Admit ${t.admit}</p>
      <table role="presentation" style="font-size:15px;border-collapse:collapse;">${rowHtml}</table>
      <p style="text-align:center;margin:16px 0 4px;"><img src="cid:${qrCid}" width="200" height="200" alt="QR code of ticket ${escapeHtml(t.bookingNumber)}" style="background:#FFFFFF;"></p>
      <p style="text-align:center;margin:0;font-size:18px;letter-spacing:2px;"><strong>${escapeHtml(t.bookingNumber)}</strong></p>
      <p style="text-align:center;margin:4px 0 0;font-size:13px;">Show this QR at the gate. The staff can also type the booking number.</p>
    </div>
    <p>Your ticket (PDF) and GST invoice ${escapeHtml(invoiceNumber)} (PDF) are attached. All times are in IST.</p>
    ${button(link, 'Open my ticket')}`)
  const text = `Namaste ${name},

Your booking is confirmed. Enjoy the show!

${t.movieTitle} (${t.movieInfo}) · Admit ${t.admit}
${rows.map(([label, value]) => `${label}: ${value}`).join('\n')}
Booking number: ${t.bookingNumber}

Show the QR code (in the attached ticket PDF) at the gate. The staff can also type the booking number.
Your ticket (PDF) and GST invoice ${invoiceNumber} (PDF) are attached. All times are in IST.

Open my ticket: ${link}`
  return { subject, html, text }
}

// JOB-02: paid, but the booking could not be kept (seats taken, show started, …) → refunded.
// No E-number in Section 12; the JOB-02 rule asks for this email (wording OK'd 2026-10-07).
export function paymentRefundedTemplate({ name, movieTitle, showText, amountText }) {
  const subject = `Talkies – payment refunded: ${movieTitle}`
  const html = layout(`
    <p>Namaste ${escapeHtml(name)},</p>
    <p>Your payment for <strong>${escapeHtml(movieTitle)}</strong> (${escapeHtml(showText)}) went through, but we could not keep your seats.</p>
    <p>We refunded <strong>${escapeHtml(amountText)}</strong>. No booking was made.</p>`)
  const text = `Namaste ${name},

Your payment for ${movieTitle} (${showText}) went through, but we could not keep your seats.
We refunded ${amountText}. No booking was made.`
  return { subject, html, text }
}
