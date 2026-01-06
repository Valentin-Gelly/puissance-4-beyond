import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    secure: false,
    auth: process.env.MAIL_USER
        ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
        : undefined,
});

export async function sendVerificationEmail(email: string, token: string) {
    try {
        const verifyUrl = `${process.env.APP_URL}/api/verify?token=${token}`;

        const html = `
      <div style="font-family: sans-serif; text-align: center;">
        <h2>Confirmez votre adresse e-mail</h2>
        <p>Merci de vous être inscrit ! Cliquez sur le bouton ci-dessous pour confirmer votre compte :</p>
        <a href="${verifyUrl}"
           style="display:inline-block;background:#2563eb;color:white;
                  padding:10px 20px;border-radius:8px;text-decoration:none;">
          Confirmer mon e-mail
        </a>
      </div>
    `;

        await transporter.sendMail({
            from: process.env.MAIL_FROM,
            to: email,
            subject: "Confirmez votre adresse e-mail",
            html,
        });

        console.log("✅ Email envoyé à", email);
    } catch (err) {
        console.error("❌ ERREUR SMTP", err);
        throw err;
    }
}

