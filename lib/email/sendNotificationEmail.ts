import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type SendNotificationEmailParams = {
  to: string;
  subject: string;
  heading: string;
  body: string;
  link: string;
};

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
        <h2>${heading}</h2>
        <p>${body}</p>
        <p><a href="${link}">View in Next Wave Dev Central Hub</a></p>
      `,
    });
  } catch (error) {
    console.error("Failed to send notification email:", error);
  }
}
