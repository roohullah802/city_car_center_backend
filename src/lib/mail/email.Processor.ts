import { Worker, Job } from "bullmq";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();
import { connection } from './redis';

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER || 'jaanroohullah83@gmail.com',
    pass: process.env.SMTP_PASS,
  },
  tls: {
      rejectUnauthorized: false
    },
    logger: true,
    debug: true
});


const worker = new Worker(
  "emailQueue",
  async (job: Job) => {
    const { to } = job.data;  

    if (job.name === "leaseConfirmationEmail") {
      const { leaseId, startDate, endDate } = job.data;

      await transporter.sendMail({
        from: process.env.SMTP_USER || 'jaanroohullah83@gmail.com',
        to,
        subject: "Your Lease Confirmation",
        html: `
          <p>Hi,</p>
          <p>Your lease has been confirmed.</p>
          <p><strong>Start:</strong> ${startDate}<br/>
             <strong>End:</strong> ${endDate}</p>
          <p>Lease ID: ${leaseId}</p>
          <p>Thank you for using City Car Center!</p>
        `,
      });

    }

    if (job.name === 'leaseExtendedEmail') {
       const { leaseId, endDate } = job.data;

      await transporter.sendMail({
        from: process.env.SMTP_USER || 'jaanroohullah83@gmail.com',
        to,
        subject: "Your Lease extension Confirmation",
        html: `
          <p>Hi,</p>
          <p>Your lease has been extended.</p>
             <strong>End:</strong> ${endDate}</p>
          <p>Lease ID: ${leaseId}</p>
          <p>Thank you for using City Car Center!</p>
        `,
      });

    }
  },
  { connection }
);

worker.on("failed", (job, err) => {
  console.error(`❌ Job failed for ${job?.data?.to}:`, err);
});
