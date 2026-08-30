import "server-only";

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type NewTicketEmailData = {
  ticketNumber: string;
  title: string;
  description: string;
  priority: TicketPriority;
  categoryName: string;
  departmentName: string;
  requesterName: string;
  requesterEmail: string;
  submittedAt: string;
  url: string;
  preferencesUrl: string;
  logoUrl: string;
};

// Border/text colors for the priority pill — same LOW→URGENT escalation as
// PRIORITY_BADGE (app/(dashboard)/tickets/ticket-badges.ts), translated from
// Bootstrap variants to hex since email clients don't get our stylesheet.
const PRIORITY_COLOR: Record<TicketPriority, { border: string; text: string }> = {
  LOW: { border: "#8a8a8d", text: "#5d5d60" },
  MEDIUM: { border: "#5980a6", text: "#416180" },
  HIGH: { border: "#c98a2e", text: "#8a5b12" },
  URGENT: { border: "#c1352b", text: "#8a231b" },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function tagChip(label: string): string {
  return `<span style="display:inline-block; font-family:Arial,Helvetica,sans-serif; font-size:11px; letter-spacing:0.02em; color:#5d5d60; background-color:#e9e9ea; padding:3px 10px; margin-right:4px;">${escapeHtml(label)}</span>`;
}

// Shared by every ticket-notification email — the logo + app name row at
// the top of the branded card. `logoUrl` must be absolute (an email client
// can't resolve a relative/site-root path the way a browser can).
function brandHeaderRow(logoUrl: string): string {
  return `<tr>
    <td class="px" style="padding:0 8px 20px 8px; border-bottom:1px solid #d4d4d7;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tbody><tr>
          <td style="font-family:Arial,Helvetica,sans-serif; font-weight:700; font-size:15px; letter-spacing:0.09em; text-transform:uppercase; color:#416180;">
            <img src="${escapeHtml(logoUrl)}" width="20" height="20" alt="" style="vertical-align:middle; margin-right:8px; border-radius:4px;">
            <span style="vertical-align:middle;">Helpdesk System</span>
          </td>
          <td align="right" style="font-family:Arial,Helvetica,sans-serif; font-size:12px; color:#5d5d60;">
            Ticket queue
          </td>
        </tr>
      </tbody></table>
    </td>
  </tr>`;
}

// Ticket-notification email — design adapted from a shared Claude design
// artifact ("Ticket Notification Email") into a table-based, inline-styled
// HTML email (the layout technique real email clients need; no external
// CSS/fonts). Used for the "new ticket" admin notification; every
// user-supplied field is HTML-escaped since ticket title/description/
// requester name are attacker-controllable free text.
export function renderNewTicketEmail(data: NewTicketEmailData): { subject: string; html: string; text: string } {
  const priorityColor = PRIORITY_COLOR[data.priority];
  const priorityLabel = `${data.priority.charAt(0)}${data.priority.slice(1).toLowerCase()} priority`;
  const subject = `New ticket ${data.ticketNumber} opened`;
  const preheader = `New ticket ${data.ticketNumber} — "${data.title}" — submitted by ${data.requesterName}, priority ${data.priority}.`;

  const title = escapeHtml(data.title);
  const description = escapeHtml(data.description);
  const requesterName = escapeHtml(data.requesterName);
  const requesterEmail = escapeHtml(data.requesterEmail);
  const ticketNumber = escapeHtml(data.ticketNumber);

  const html = `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${subject}</title>

<!--[if mso]>
<style>
table { border-collapse: collapse; border-spacing: 0; }
td, a { font-family: Arial, sans-serif; }
</style>
<![endif]-->
<style>
  body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  img { -ms-interpolation-mode: bicubic; }
  a { text-decoration: none; }
  @media only screen and (max-width: 620px) {
    .wrap { width: 100% !important; }
    .px { padding-left: 20px !important; padding-right: 20px !important; }
    .meta-td { display: block !important; width: 100% !important; padding-bottom: 12px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#f2f2f3;">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#f2f2f3;">
    ${escapeHtml(preheader)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2f2f3;">
    <tbody><tr>
      <td align="center" style="padding:36px 16px;">
        <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">

          <tbody>${brandHeaderRow(data.logoUrl)}

          <tr><td style="height:28px; line-height:28px; font-size:0;">&nbsp;</td></tr>

          <tr>
            <td class="px" style="padding:0 8px;">
              <div style="font-family:Arial,Helvetica,sans-serif; font-weight:700; font-size:28px; line-height:1.15; color:#1d1f20; mso-line-height-rule:exactly;">
                New ticket opened
              </div>
              <div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:1.5; color:#5d5d60; padding-top:8px;">
                A new support ticket was submitted and is waiting in the queue.
              </div>
            </td>
          </tr>

          <tr><td style="height:24px; line-height:24px; font-size:0;">&nbsp;</td></tr>

          <tr>
            <td class="px" style="padding:0 8px;">
              <div style="position:relative; border:1px solid #c7c9cb;">
                <span style="position:absolute; top:-6px; left:-6px; width:11px; height:11px; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:11px; color:#7a7a7d;">+</span>
                <span style="position:absolute; top:-6px; right:-6px; width:11px; height:11px; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:11px; color:#7a7a7d;">+</span>
                <span style="position:absolute; bottom:-6px; left:-6px; width:11px; height:11px; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:11px; color:#7a7a7d;">+</span>
                <span style="position:absolute; bottom:-6px; right:-6px; width:11px; height:11px; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:11px; color:#7a7a7d;">+</span>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tbody><tr>
                    <td style="padding:22px 24px 0 24px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tbody><tr>
                          <td style="font-family:Arial,Helvetica,sans-serif; font-weight:600; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:#5d5d60;">
                            Ticket #${ticketNumber}
                          </td>
                          <td align="right">
                            <span style="display:inline-block; font-family:Arial,Helvetica,sans-serif; font-size:11px; letter-spacing:0.02em; color:${priorityColor.text}; border:1px solid ${priorityColor.border}; padding:3px 10px;">${escapeHtml(priorityLabel)}</span>
                          </td>
                        </tr>
                      </tbody></table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 24px 0 24px;">
                      <div style="font-family:Arial,Helvetica,sans-serif; font-weight:600; font-size:20px; line-height:1.25; color:#1d1f20;">
                        ${title}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 24px 0 24px;">
                      ${tagChip(data.categoryName)}${tagChip(data.departmentName)}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 24px 0 24px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tbody><tr>
                          <td class="meta-td" width="50%" valign="top" style="font-family:Arial,Helvetica,sans-serif; font-size:12px; color:#5d5d60;">
                            <div style="text-transform:uppercase; letter-spacing:0.06em; font-size:10px; color:#7a7a7d; padding-bottom:3px;">Requester</div>
                            ${requesterName}<br>
                            <a href="mailto:${requesterEmail}" style="color:#416180;">${requesterEmail}</a>
                          </td>
                          <td class="meta-td" width="50%" valign="top" style="font-family:Arial,Helvetica,sans-serif; font-size:12px; color:#5d5d60;">
                            <div style="text-transform:uppercase; letter-spacing:0.06em; font-size:10px; color:#7a7a7d; padding-bottom:3px;">Submitted</div>
                            ${escapeHtml(data.submittedAt)}
                          </td>
                        </tr>
                      </tbody></table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 24px 22px 24px; border-top:1px solid #e7e7ea; margin-top:16px;">
                      <div style="font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:1.6; color:#5d5d60; padding-top:16px; white-space:pre-wrap;">
                        "${description}"
                      </div>
                    </td>
                  </tr>
                </tbody></table>
              </div>
            </td>
          </tr>

          <tr><td style="height:28px; line-height:28px; font-size:0;">&nbsp;</td></tr>

          <tr>
            <td class="px" style="padding:0 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tbody><tr>
                  <td bgcolor="#5980a6" style="border:1px solid #5980a6;">
                    <!--[if mso]>
                    <i style="letter-spacing:28px;mso-font-width:-100%;mso-text-raise:18pt">&nbsp;</i>
                    <![endif]-->
                    <a href="${data.url}" style="display:block; padding:13px 30px; font-family:Arial,Helvetica,sans-serif; font-weight:700; font-size:14px; letter-spacing:0.05em; text-transform:uppercase; color:#f2f2f3; mso-line-height-rule:exactly;">
                      View ticket
                    </a>
                    <!--[if mso]>
                    <i style="letter-spacing:28px;mso-font-width:-100%">&nbsp;</i>
                    <![endif]-->
                  </td>
                </tr>
              </tbody></table>
            </td>
          </tr>

          <tr><td style="height:36px; line-height:36px; font-size:0;">&nbsp;</td></tr>

          <tr>
            <td class="px" style="padding:20px 8px 0 8px; border-top:1px solid #d4d4d7;">
              <div style="font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:1.6; color:#7a7a7d;">
                Automated notification from Helpdesk System's ticket queue.<br>
                <a href="${data.preferencesUrl}" style="color:#416180;">Manage notification preferences</a>
              </div>
            </td>
          </tr>

        </tbody></table>
      </td>
    </tr>
  </tbody></table>
</body></html>`;

  const text = [
    `New ticket ${data.ticketNumber} opened`,
    `${data.title} (${priorityLabel})`,
    `Category: ${data.categoryName} · Department: ${data.departmentName}`,
    `Requester: ${data.requesterName} <${data.requesterEmail}>`,
    `Submitted: ${data.submittedAt}`,
    "",
    data.description,
    "",
    `View ticket: ${data.url}`,
  ].join("\n");

  return { subject, html, text };
}

export type TicketNotificationEmailData = {
  subject: string;
  /** Large headline, e.g. "Ticket assigned to you", "Approval requested". */
  heading: string;
  /** One-sentence explanation under the headline. */
  intro: string;
  ticket: {
    ticketNumber: string;
    title: string;
    priority: TicketPriority;
    categoryName: string;
    departmentName: string;
  };
  ctaLabel: string;
  ctaUrl: string;
  preferencesUrl: string;
  logoUrl: string;
};

// Generic branded shell shared by every lifecycle notification other than
// the new-ticket one above (EM01/EM03–EM09 — see app/lib/notifications.ts):
// same header/footer/fonts/colors, just a headline + intro + compact ticket
// card + one CTA instead of the new-ticket email's fuller requester/
// description layout. Every user-supplied field is HTML-escaped since
// ticket titles are attacker-controllable free text.
export function renderTicketNotificationEmail(
  data: TicketNotificationEmailData
): { subject: string; html: string; text: string } {
  const priorityColor = PRIORITY_COLOR[data.ticket.priority];
  const priorityLabel = `${data.ticket.priority.charAt(0)}${data.ticket.priority.slice(1).toLowerCase()} priority`;
  const preheader = `Ticket ${data.ticket.ticketNumber} — "${data.ticket.title}" — ${data.intro}`;

  const heading = escapeHtml(data.heading);
  const intro = escapeHtml(data.intro);
  const title = escapeHtml(data.ticket.title);
  const ticketNumber = escapeHtml(data.ticket.ticketNumber);
  const ctaLabel = escapeHtml(data.ctaLabel);

  const html = `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(data.subject)}</title>

<!--[if mso]>
<style>
table { border-collapse: collapse; border-spacing: 0; }
td, a { font-family: Arial, sans-serif; }
</style>
<![endif]-->
<style>
  body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  img { -ms-interpolation-mode: bicubic; }
  a { text-decoration: none; }
  @media only screen and (max-width: 620px) {
    .wrap { width: 100% !important; }
    .px { padding-left: 20px !important; padding-right: 20px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#f2f2f3;">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#f2f2f3;">
    ${escapeHtml(preheader)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2f2f3;">
    <tbody><tr>
      <td align="center" style="padding:36px 16px;">
        <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">

          <tbody>${brandHeaderRow(data.logoUrl)}

          <tr><td style="height:28px; line-height:28px; font-size:0;">&nbsp;</td></tr>

          <tr>
            <td class="px" style="padding:0 8px;">
              <div style="font-family:Arial,Helvetica,sans-serif; font-weight:700; font-size:28px; line-height:1.15; color:#1d1f20; mso-line-height-rule:exactly;">
                ${heading}
              </div>
              <div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:1.5; color:#5d5d60; padding-top:8px;">
                ${intro}
              </div>
            </td>
          </tr>

          <tr><td style="height:24px; line-height:24px; font-size:0;">&nbsp;</td></tr>

          <tr>
            <td class="px" style="padding:0 8px;">
              <div style="position:relative; border:1px solid #c7c9cb;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tbody><tr>
                    <td style="padding:20px 24px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tbody><tr>
                          <td style="font-family:Arial,Helvetica,sans-serif; font-weight:600; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:#5d5d60;">
                            Ticket #${ticketNumber}
                          </td>
                          <td align="right">
                            <span style="display:inline-block; font-family:Arial,Helvetica,sans-serif; font-size:11px; letter-spacing:0.02em; color:${priorityColor.text}; border:1px solid ${priorityColor.border}; padding:3px 10px;">${escapeHtml(priorityLabel)}</span>
                          </td>
                        </tr>
                      </tbody></table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 24px 4px 24px;">
                      <div style="font-family:Arial,Helvetica,sans-serif; font-weight:600; font-size:18px; line-height:1.25; color:#1d1f20;">
                        ${title}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 24px 20px 24px;">
                      ${tagChip(data.ticket.categoryName)}${tagChip(data.ticket.departmentName)}
                    </td>
                  </tr>
                </tbody></table>
              </div>
            </td>
          </tr>

          <tr><td style="height:28px; line-height:28px; font-size:0;">&nbsp;</td></tr>

          <tr>
            <td class="px" style="padding:0 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tbody><tr>
                  <td bgcolor="#5980a6" style="border:1px solid #5980a6;">
                    <!--[if mso]>
                    <i style="letter-spacing:28px;mso-font-width:-100%;mso-text-raise:18pt">&nbsp;</i>
                    <![endif]-->
                    <a href="${data.ctaUrl}" style="display:block; padding:13px 30px; font-family:Arial,Helvetica,sans-serif; font-weight:700; font-size:14px; letter-spacing:0.05em; text-transform:uppercase; color:#f2f2f3; mso-line-height-rule:exactly;">
                      ${ctaLabel}
                    </a>
                    <!--[if mso]>
                    <i style="letter-spacing:28px;mso-font-width:-100%">&nbsp;</i>
                    <![endif]-->
                  </td>
                </tr>
              </tbody></table>
            </td>
          </tr>

          <tr><td style="height:36px; line-height:36px; font-size:0;">&nbsp;</td></tr>

          <tr>
            <td class="px" style="padding:20px 8px 0 8px; border-top:1px solid #d4d4d7;">
              <div style="font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:1.6; color:#7a7a7d;">
                Automated notification from Helpdesk System's ticket queue.<br>
                <a href="${data.preferencesUrl}" style="color:#416180;">Manage notification preferences</a>
              </div>
            </td>
          </tr>

        </tbody></table>
      </td>
    </tr>
  </tbody></table>
</body></html>`;

  const text = [
    data.heading,
    data.intro,
    "",
    `Ticket ${data.ticket.ticketNumber}: ${data.ticket.title} (${priorityLabel})`,
    `Category: ${data.ticket.categoryName} · Department: ${data.ticket.departmentName}`,
    "",
    `${data.ctaLabel}: ${data.ctaUrl}`,
  ].join("\n");

  return { subject: data.subject, html, text };
}
