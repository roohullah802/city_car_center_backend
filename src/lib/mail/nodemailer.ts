import nodemailer from 'nodemailer';
import dotenv from 'dotenv'
dotenv.config()

export async function sendEmail(to: string, code: number): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // true if using port 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS, // your app password
    },
  });

  await transporter.sendMail({
    from: `"City Car Center" <${process.env.SMTP_USER}>`,
    to,
    subject: "welcome to city car center",
    html: `
  <div style="font-family: Arial, sans-serif; color: #333;">
    <h2>Welcome to City Car Center 🚗</h2>
    <p>Hi there,</p>
    <p>Thank you for signing up. We're excited to have you on board!</p>
    <p>You can now browse, lease, and manage your car rentals with ease.</p>
    <p>Your email verification code is:  ${code}</p>

    <hr style="margin: 20px 0;" />

    <p>If you have any questions, feel free to reach out to our support team.</p>

    <p style="margin-top: 30px;">Best regards,<br/>City Car Center Team</p>
  </div>
`});
}
