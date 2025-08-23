import { Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();
import {connection} from './redis'

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});


const worker = new Worker(
  "emailQueue",
  async (job: Job) => {
    const { name } = job;
    const { to } = job.data;

    if (name === "sendVerificationEmail") {
      const { code } = job.data;
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to,
        subject: "welcome to city car center",
        html: `
        <p>Hello,</p>

        <p>Your verification code for City Car Center is:</p>

        <h2 style="color: #2e6c80;">{${code}}</h2>

        <p>This code is valid for the next 5 minutes. Please do not share it with anyone.</p>

        <p>If you did not request this code, please ignore this email.</p>

        <p>Thank you,<br/>
        City Car Center Team</p>`,
      });

      console.log(`✅ Email sent to ${to}`);
    }

    if (name === "leaseConfirmationEmail") {
      const { leaseId,  startDate, endDate } = job.data;

      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to,
        subject: "Your Lease Confirmation",
        html: `
          <p>Hi,</p>
          <p>Your lease  has been confirmed.</p>
          <p><strong>Start:</strong> ${startDate}<br/>
             <strong>End:</strong> ${endDate}</p>
          <p>Lease ID: ${leaseId}</p>
          <p>Thank you for using City Car Center!</p>
        `,
      });

      console.log(`✅ Lease confirmation email sent to ${to}`);
    }

    if (name === 'resendEmailOtp') {
        const {code} = job.data;
        await transporter.sendMail({
        from: process.env.SMTP_USER,
        to,
        subject: "Email verification code",
        html: `
        <p>Hello,</p>

        <p>Your verification code for City Car Center is:</p>

        <h2 style="color: #2e6c80;">{${code}}</h2>

        <p>This code is valid for the next 5 minutes. Please do not share it with anyone.</p>

        <p>If you did not request this code, please ignore this email.</p>

        <p>Thank you,<br/>
        City Car Center Team</p>`,
      });

      console.log(`✅ Email sent to ${to}`);
    }
  },
  { connection }
);

worker.on("failed", (job, err) => {
  console.error(`❌ Job failed for ${job?.data?.to}:`, err);
});
