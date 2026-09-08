import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type SendNotificationEmailParams = {
  to: string;
  subject: string;
  heading: string;
  body: string;
  link: string;
};

// heading/body are user-submitted DM and announcement text — escape entities
// before interpolating into the HTML body so a message can't inject markup
// (links, images, scripts) into mail sent from a trusted address.
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtmlWithBreaks(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

export async function sendNotificationEmail({
  to,
  subject,
  heading,
  body,
  link,
}: SendNotificationEmailParams) {
  if (!process.env.RESEND_API_KEY) return;

  try {
    await resend.emails.send({
      from: "Next Wave Dev Central Hub <notifications@nextwavedev.org>",
      to,
      subject,
      html: `
        <h2>${escapeHtml(heading)}</h2>
        <p>${escapeHtmlWithBreaks(body)}</p>
        <p><a href="${link}">View in Next Wave Dev Central Hub</a></p>
      `,
    });
  } catch (error) {
    console.error("Failed to send notification email:", error);
  }
}
