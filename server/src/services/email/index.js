import { ServerClient } from 'postmark'

// Sends one email (Section 12).
// With POSTMARK_API_KEY set: sends with Postmark.
// Without it (development now): prints the email in the server console instead.
// attachments: [{ name, content (Buffer), contentType, contentId? }]; contentId = a picture
// shown inside the email (<img src="cid:…">).
let client

export async function sendEmail({ to, subject, html, text, attachments = [] }) {
  const apiKey = process.env.POSTMARK_API_KEY
  if (!apiKey) {
    const files = attachments.map((a) => `${a.name} (${Math.ceil(a.content.length / 1024)} KB${a.contentId ? ', inside the email' : ''})`)
    const list = files.length ? `\nAttachments: ${files.join(' · ')}` : ''
    console.log(`\n--- Email (console, no POSTMARK_API_KEY) ---\nTo: ${to}\nSubject: ${subject}${list}\n\n${text}\n--- End email ---\n`)
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
    Attachments: attachments.map((a) => ({
      Name: a.name,
      Content: a.content.toString('base64'),
      ContentType: a.contentType,
      ...(a.contentId && { ContentID: `cid:${a.contentId}` }),
    })),
  })
}
