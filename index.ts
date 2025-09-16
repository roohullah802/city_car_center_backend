import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/db/mongodb";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { userAuthRouter } from "./src/routers/user/auth.router";
import { userRouter } from "./src/routers/user/user.router";
import { adminRouter } from "./src/routers/admin/admin.router";
import { connectRedis } from "./src/lib/redis/redis";
import "./src/lib/mail/reminder/leaseReminderWorker";
import { leaseReminderQueue } from "./src/lib/mail/reminder/leaseReminderQueue";
import "./src/lib/mail/email.Processor";
import paymentRoutes from './src/routers/payment/payment'

dotenv.config();
connectRedis();

const app = express();

const corsOptions = {
  origin: [
    "http://localhost:3000", // React.js (local dev)
    "http://127.0.0.1:5000", // alternate localhost
    "http://localhost:19006", // React Native Web (Expo)
    "http://localhost:8081", // React Native CLI
    "your-frontend-domain.com", // Production frontend
    "http://82.25.85.117:5000",
    "http://localhost:5173/",
    "*",
  ],
  credentials: true, // If you're using cookies or auth headers
};

// app.use(
//   (req, res, next) => {
//     if (req.originalUrl === "/api/payment/webhook") {
//       next();
//     } else {
//       bodyParser.json()(req, res, next);
//     }
//   }
// );


app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/api/user/auth", userAuthRouter);
app.use("/api/user", userRouter);
app.use("/api/v1/secure/route/admin", adminRouter);
app.use('/api/payment', paymentRoutes);






const PORT = process.env.PORT || 5000;

async function init() {
  try {
    const jobs = await leaseReminderQueue.getRepeatableJobs();
    const alreadyExists = jobs.find((job) => job.name === "sendLeaseReminders");

    if (!alreadyExists) {
      await leaseReminderQueue.add(
        "sendLeaseReminders",
        {},
        {
          repeat: {
            cron: "0 * * * *",
          } as any,
          removeOnComplete: true,
          removeOnFail: true,
        }
      );

      console.log("✅ Lease reminder job scheduled (hourly)");
    } else {
      console.log("⏳ Lease reminder job already exists");
    }
  } catch (err) {
    console.error("❌ Failed to schedule lease reminder job:", err);
  }
}

init();

mongoose
  .connect(process.env.MONGODB_URI!, {})
  .then(() => {
    connectDB();
    console.log("MongoDB connected");
    app.listen(5000, "0.0.0.0", () =>
      console.log(`Server running on port ${PORT}`)
    );
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
  });
