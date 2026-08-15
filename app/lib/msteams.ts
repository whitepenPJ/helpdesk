import "server-only";

// Stub — no MS Teams webhook is configured yet (the user will set one up
// later). Once MS_TEAMS_WEBHOOK_URL is set, this posts the standard Teams
// Incoming Webhook payload shape; until then it's a no-op.
export async function sendTeamsNotification(text: string): Promise<void> {
  const webhookUrl = process.env.MS_TEAMS_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log("sendTeamsNotification: MS_TEAMS_WEBHOOK_URL not configured — skipping", { text });
    return;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`MS Teams webhook failed (${response.status}): ${detail}`);
  }
}
