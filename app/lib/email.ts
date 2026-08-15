import "server-only";

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

// Mailgun's HTTP API — plain fetch, no SDK needed. Matches
// EMAIL_PROVIDER=mailgun / EMAIL_FROM already configured in .env.
export async function sendEmail({ to, subject, text, html }: EmailMessage): Promise<void> {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !domain || !from) {
    console.error("sendEmail: missing MAILGUN_API_KEY, MAILGUN_DOMAIN, or EMAIL_FROM — skipping send");
    return;
  }

  const body = new URLSearchParams({ from, to, subject, text, ...(html ? { html } : {}) });

  const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Mailgun send failed (${response.status}): ${detail}`);
  }
}
