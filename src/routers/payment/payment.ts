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
      const userId = req.user?.userId;
      const carId = req?.params.id;
      const { startDate, endDate } = req.body;

      if (!userId || !carId) {
        res
          .status(400)
          .json({ success: false, message: "Missing required fields" });
        return;
      }
      if (!startDate || !endDate) {
        res.status(400).json({
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
          message:
            "We're sorry, but this car is currently unavailable for lease.",
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
          action: "createLease",
          email: req.user?.email!,
          userId,
          carId,
          startDate,
          endDate,
        },
      });

      res.status(200).json({
        success: true,
        message: "payment intend created",
        paymentId: paymentIntent?.id,
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error: any) {
      console.log(error);
      
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

router.post(
  "/create-payment-intent-for-extend-lease/:id",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const leaseId = req.params.id;
      const { additionalDays } = req.body;

      if (!userId || !leaseId) {
        res.status(400).json({
          success: false,
          message: "Missing required fields",
        });
        return;
      }

      if (!additionalDays || additionalDays <= 0) {
        res.status(400).json({
          success: false,
          message: "Please provide valid additionalDays.",
        });
        return;
      }

      const lease = await Lease.findById(leaseId).populate("car");

      if (!lease) {
        res.status(404).json({ success: false, message: "Lease not found." });
        return;
      }

      if (lease.user.toString() !== userId) {
        res.status(403).json({
          success: false,
          message: "Unauthorized to modify this lease.",
        });
        return;
      }

      const car = lease.car as any;
      if (!car?.pricePerDay) {
        res.status(400).json({
          success: false,
          message: "Car does not have a valid daily rate.",
        });
        return;
      }

      const oldEndDate = new Date(lease.endDate);
      const newEndDate = new Date(oldEndDate);
      newEndDate.setDate(newEndDate.getDate() + additionalDays);

      const dailyRate = car.pricePerDay;
      const totalAmount = dailyRate * additionalDays * 100; // cents

      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmount,
        currency: "usd",
        metadata: {
          action: "extendLease",
          email: req.user?.email || "",
          userId,
          leaseId,
          carId: car._id.toString(),
          additionalDays: additionalDays.toString(),
          endDate: newEndDate.toISOString(),
        },
      });

      res.status(200).json({
        success: true,
        message: "PaymentIntent created",
        paymentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error: any) {
      res
        .status(400)
        .json({ success: false, message: error.message || "Something went wrong" });
    }
  }
);


export default router;
