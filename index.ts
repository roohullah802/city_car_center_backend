import express, { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/db/mongodb";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { userAuthRouter } from "./src/routers/user/auth.router";
import { userRouter } from "./src/routers/user/user.router";
import { adminRouter } from "./src/routers/admin/admin.router";
import { connectRedis, redisClient } from "./src/lib/redis/redis";
import "./src/lib/mail/reminder/leaseReminderWorker";
import { leaseReminderQueue } from "./src/lib/mail/reminder/leaseReminderQueue";
import "./src/lib/mail/email.Processor";
import paymentRoutes from "./src/routers/payment/payment";
import Stripe from "stripe";
import { Lease } from "./src/models/Lease.model";
import { emailQueue } from "./src/lib/mail/emailQueues";
import { Car } from "./src/models/car.model";
import { Server } from "socket.io";
import http from "http";
import { AdminActivity } from "./src/models/adminActivity";
import {startCronJob} from './src/lib/node_cron/node.cron';

dotenv.config();
connectRedis();

const app = express();
const serverr = http.createServer(app);

const io = new Server(serverr, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

app.use((req: Request, res: Response, next: NextFunction) => {
  req.io = io;
  next();
});

const corsOptions = {
  origin: [
    "http://localhost:5173", 
    "https://api.citycarcenters.com",
  ],
  credentials: true, 
};



const stripe = new Stripe(process.env.STRIPE_SERVER_KEY as string, {
  apiVersion: "2025-05-28.basil",
});

// Webhook route
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response): Promise<void> => {
    const sig = req.headers["stripe-signature"] as string;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET as string
      );
    } catch (err: any) {
      console.error("⚠️ Webhook signature verification failed:", err.message);
      res.status(400).json({ success: false, message: "webhook failed" });
      return;
    }

    // Handle successful payment
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      const { action, userId, leaseId, carId, startDate, endDate, email } =
        paymentIntent.metadata;

      try {
        if (action === "createLease" && userId && carId) {
          // Create new lease
          const lease = await Lease.create({
            user: userId,
            car: carId,
            totalAmount: paymentIntent.amount / 100,
            status: "active",
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            paymentId: paymentIntent.id,
          });

          // Update car availability
          await Car.findByIdAndUpdate(carId, { available: false });

          // Update Redis cache
          await redisClient.hSet(`carDetails:${carId}`, "available", "false");
          await redisClient.del(`leases:${userId}`);
          await redisClient.del(`leasePaymentHistory:${userId}`);

          // Send confirmation email via queue
          await emailQueue.add(
            "leaseConfirmationEmail",
            { leaseId: lease._id, startDate, endDate, to: email },
            { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
          );

          // Notify clients via socket.io
          req.io.emit("leaseCreated", lease);

          await AdminActivity.create({
            action: "Lease Created",
            user: userId,
            lease: lease._id,
            car: carId,
            description: `User ${userId} booked car ${carId} from ${startDate} to ${endDate}`,
          });
        }

        if (action === "extendLease" && userId && leaseId) {
          // Extend lease
          const lease = await Lease.findByIdAndUpdate(
            leaseId,
            { endDate: new Date(endDate), status: 'active' },
            { new: true }
          );

          if (!lease) {
            console.error("Lease not found for extension:", leaseId);
          } else {
            // Clear Redis caches
            await redisClient.del(`leaseDetails:${leaseId}`);
            await redisClient.del(`leases:${userId}`);
            await redisClient.del(`leasePaymentHistory:${userId}`);

            // Send confirmation email
            await emailQueue.add(
              "leaseExtendedEmail",
              { leaseId: lease._id, endDate, to: email },
              { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
            );

            // Notify clients
            req.io.emit("leaseExtended", lease);
            await AdminActivity.create({
              action: "Lease Extended",
              user: userId,
              lease: lease._id,
              car: carId,
              description: `User ${userId} extended lease ${leaseId} until ${endDate}`,
            });
          }
        }
      } catch (err) {
        console.error("❌ Error handling webhook:", err);
      }
    }

    // Handle failed payment
    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.warn("❌ Payment failed for intent:", paymentIntent.id);

      res.status(400).json({
        success: false,
        message: "Payment has failed! Please try again.",
      });
      return;
    }

    res.json({ received: true });
  }
);

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/api/user/auth", userAuthRouter);
app.use("/api/user", userRouter);
app.use("/api/v1/secure/route/admin", adminRouter);
app.use("/api/payment", paymentRoutes);

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
  .connect(
    process.env.MONGODB_URI! || "mongodb://127.0.0.1:27017/city_car_center",
    {}
  )
  .then(() => {
    connectDB();
    console.log("MongoDB connected");
    startCronJob();
    serverr.listen(5000, "0.0.0.0", () =>
      console.log(`Server running on port ${PORT}`)
    );
  })

  .catch((err) => {
    console.error("DB connection failed:", err);
  });
