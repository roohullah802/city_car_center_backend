import express, { Request, Response } from "express";
import Stripe from "stripe";
import { Lease } from "../../models/Lease.model";
import dotenv from "dotenv";
import { Car } from "../../models/car.model";
import { redisClient } from "../../lib/redis/redis";
import { emailQueue } from "../../lib/mail/emailQueues";
import { authMiddleware } from "../../middleware/auth.middleware";
import mongoose from "mongoose";
import { log } from "console";
dotenv.config();

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SERVER_KEY as string, {
  apiVersion: "2025-05-28.basil",
});

// ✅ Create a Payment Intent
router.post(
  "/create-payment-intent/:id",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId; // <-- from auth middleware
      const carId = req?.params.id;
      const { startDate, endDate } = req.body;

      if (!userId || !carId) {
        res
          .status(400)
          .json({ success: false, message: "Missing required fields" });
        return;
      }
      if (!startDate || !endDate) {
        res
          .status(400)
          .json({
            success: false,
            message: "Please provide the required fileds.",
          });
        return;
      }

      const redisCars = await redisClient.get(`AllCars:AllCars`);
      let car;
      if (redisCars) {
        const allCars = JSON.parse(redisCars);
        car = allCars.find((c: any) => c._id === carId);
      } else {
        car = await Car.findById(carId);
        if (!car) {
          res.status(404).json({
            success: false,
            message: "Car not found.",
          });
          return;
        }
      }

      if (!car.available) {
        res.status(400).json({
          success: false,
          message: "We're sorry, but this car is currently unavailable for lease.",
        });
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      const dayDifference = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (dayDifference !== 7) {
        res.status(400).json({
          success: false,
          message: "The first lease must be exactly 7 days long.",
        });
        return;
      }

      const totalAmount = (car.pricePerDay as number) * 7;

      const existingLease = await Lease.findOne({
        car: new mongoose.Types.ObjectId(carId),
        status: "completed",
        $or: [
          {
            startDate: { $lte: new Date(endDate) },
            endDate: { $gte: new Date(startDate) },
          },
        ],
      });

      if (existingLease) {
        res.status(409).json({
          success: false,
          message: "Car not available for these dates",
        });

        return;
      }

      const existCar = await Car.findById(carId);
      if (!existCar) {
        res.status(400).json({ success: false, message: "Car not fount." });
        return;
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmount * 100, // cents
        currency: "usd",
        metadata: {
          email: req.user?.email!,
          userId, // 👈 store userId
          carId, // 👈 store carId
          startDate,
          endDate,
        },
      });

      res
        .status(200)
        .json({
          success: true,
          message: "payment intend created",
          paymentId: paymentIntent?.id,
          clientSecret: paymentIntent.client_secret,
        });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

router.post(
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
          amount: paymentIntent.amount / 100,
          paymentIntentId: paymentIntent.id,
          status: "completed",
          startDate: new Date(startDate),
          endDate: new Date(endDate),
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
      console.log('payment is failed!!');
      
    }
  }
);

export default router;
