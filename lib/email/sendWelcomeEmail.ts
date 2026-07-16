import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type SendWelcomeEmailParams = {
  email: string;
  temporaryPassword: string;
  loginUrl: string;
};

export async function sendWelcomeEmail({
  email,
  temporaryPassword,
  loginUrl,
}: SendWelcomeEmailParams) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY");
  }

  try {
    console.log("=================================");
    console.log("Attempting to send welcome email");
    console.log("Recipient:", email);
    console.log("Login URL:", loginUrl);
    console.log("=================================");

    const response = await resend.emails.send({
      from: "Next Wave Dev Central Hub <onboarding@nextwavedev.org>",
      to: email,
      subject: "Welcome to Next Wave Dev Central Hub",
      html: `
        <h1>Welcome to Next Wave Dev Central Hub</h1>

        <p>Your account has been created successfully.</p>

        <p>
          <strong>Login Link:</strong>
          <a href="${loginUrl}">${loginUrl}</a>
        </p>

        <p>
          <strong>Temporary Password:</strong>
          ${temporaryPassword}
        </p>

        <p>
          Please log in and update your password immediately.
        </p>
      `,
    });

    console.log("RESEND RESPONSE:");
    console.log(response);

    return response;
  } catch (error) {
    console.error("RESEND ERROR:");
    console.error(error);
    throw error;
  }
}