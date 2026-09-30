import { ServerClient } from 'postmark'

// Sends one email (Section 12).
// With POSTMARK_API_KEY set: sends with Postmark.
// Without it (development now): prints the email in the server console instead.
let client

export async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.POSTMARK_API_KEY
  if (!apiKey) {
    console.log(`\n--- Email (console, no POSTMARK_API_KEY) ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n--- End email ---\n`)
    return
  }

  client ??= new ServerClient(apiKey)
  await client.sendEmail({
    From: process.env.EMAIL_FROM,
    To: to,
    Subject: subject,
    HtmlBody: html,
    TextBody: text,
    MessageStream: 'outbound',
  })
}
