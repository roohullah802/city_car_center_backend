import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

export async function sendVerificationEmail(to: string, code: number): Promise<void> {
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
  <p>Hello,</p>

<p>Your verification code for City Car Center is:</p>

<h2 style="color: #2e6c80;">{${code}}</h2>

<p>This code is valid for the next 5 minutes. Please do not share it with anyone.</p>

<p>If you did not request this code, please ignore this email.</p>

<p>Thank you,<br/>
City Car Center Team</p>

`,
  });
}
