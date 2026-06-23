type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail({ to, subject, html }: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "cAsker <onboarding@resend.dev>";

  if (!apiKey) {
    throw new Error(
      "Chýba RESEND_API_KEY. Pridajte ho do .env.local pre odosielanie e-mailov.",
    );
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { id?: string; message?: string; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? payload?.error ?? "E-mail sa nepodarilo odoslať.");
  }

  return payload;
}
