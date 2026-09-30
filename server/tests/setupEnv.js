// Runs before every test file: test-only settings (never real secrets)
process.env.JWT_ACCESS_SECRET ??= 'test-only-access-secret-at-least-32-characters-long'
process.env.CLIENT_URL ??= 'http://localhost:5173'
delete process.env.POSTMARK_API_KEY // tests never send real emails
