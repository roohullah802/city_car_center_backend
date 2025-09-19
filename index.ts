import express, { Request, Response } from "express";
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
import paymentRoutes from './src/routers/payment/payment'
import Stripe from "stripe";
import { Lease } from "./src/models/Lease.model";
import { emailQueue } from "./src/lib/mail/emailQueues";
import { Car } from "./src/models/car.model";


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
    "https://api.citycarcenters.com",
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

const stripe = new Stripe(process.env.STRIPE_SERVER_KEY as string, {
  apiVersion: "2025-05-28.basil",
});

app.post("/webhook",express.raw({ type: "application/json" }),async (req: Request, res: Response): Promise<void> => {
    const sig = req.headers["stripe-signature"] as string;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET as string
      );
    } catch (err: any) {
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log('payment is created sucessfully');
      

      // // ✅ Read metadata values
      const { userId, carId, startDate, endDate, email } = paymentIntent.metadata; 

      let lease;
      if (userId && carId) {
       lease =  await Lease.create({
          user: userId,
          car: carId,
          totalAmount: paymentIntent.amount / 100,
          paymentIntentId: paymentIntent.id,
          status: "completed",
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          paymentId: paymentIntent.id
        });

        await Car.findByIdAndUpdate(carId, {
            available: false
        }, {new: true});

        const redisCars = await redisClient.get('AllCars:AllCars');
        if (redisCars) {
            const allCars = JSON.parse(redisCars);
            const cars = allCars.find((c:any)=> c._id === carId);
            if (cars) {
                cars.available = false
                return cars
            }
        }
        await redisClient.hSet(`carDetails:${carId}`, 'available', 'false');
        await redisClient.del(`leasePaymentHistory:${userId}`);

        await emailQueue.add(
              "leaseConfirmationEmail",
              { leaseId: lease._id, startDate, endDate, to: email },
              {
                attempts: 3,
                backoff: {
                  type: "exponential",
                  delay: 5000,
                },
              }
            );

      }
    }
    if (event.type === "payment_intent.payment_failed") {
      res.status(400).json({success: false, message:"payment has failed! please try again"})
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
  .connect(process.env.MONGODB_URI! || 'mongodb://127.0.0.1:27017/city_car_center', {})
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
