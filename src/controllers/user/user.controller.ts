import dotenv from "dotenv";
dotenv.config();
import { Request, Response } from "express";
import { Car } from "../../models/car.model";
import mongoose from "mongoose";
import { Lease } from "../../models/Lease.model";
import Stripe from "stripe";
import { redisClient } from "../../lib/redis/redis";
import { Faq } from "../../models/faqs.model";
import { Policy } from "../../models/policy.model";
import { IssueReport } from "../../models/report.model";



/**
 * @route   POST /api/cars/details
 * @desc    Get details of a single car, including its reviews
 * @access  Public or Protected (depending on your setup)
 */
export async function getCarDetails(
  req: Request,
  res: Response
): Promise<void> {
  type CarId = {
    id: string;
  };

  const { id } = req.params as CarId;

  try {
    if (!id) {
      res.status(400).json({
        success: false,
        message: "Please provide a valid carId to fetch car details.",
      });
      return;
    }

    const redisCarDetails = await redisClient.hGetAll(`carDetails:${id}`);
    let cars;
    if (Object.keys(redisCarDetails).length > 0) {
      cars = redisCarDetails;
    } else {
      cars = await Car.aggregate([
        {
          $match: { _id: new mongoose.Types.ObjectId(id) },
        },
        {
          $lookup: {
            from: "reviews",
            localField: "_id",
            foreignField: "car",
            as: "car_reviews",
          },
        },
        {
          $addFields: {
            totalReviews: { $size: "$car_reviews" },
            averageRating: { $avg: "$car_reviews.rating" },
          },
        },
      ]);

      const carData = cars[0];
      const redisHash: Record<string, string> = {};

      for (let [field, value] of Object.entries(carData)) {
        redisHash[field] =
          typeof value === "object" ? JSON.stringify(value) : String(value);
      }

      await redisClient.hSet(`carDetails:${id}`, redisHash);
      await redisClient.expire(`carDetails:${id}`, 86400);

      if (!cars || cars.length === 0) {
        res.status(404).json({
          success: false,
          message: "Car not found with the provided ID.",
        });
        return;
      }
    }

    res.status(200).json({
      success: true,
      message: "Car details fetched successfully.",
      data: cars,
    });
  } catch (error) {
    console.error("Error fetching car details:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching car details.",
    });
  }
}

/**
 * @route   GET /api/cars
 * @desc    Fetch all available cars
 * @access  Protected (requires authenticated user)
 */
export async function getAllCars(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;

  try {
    // Get page and limit from query parameters, with defaults
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const redisKey = `AllCars:CarsArray:page:${page}:limit:${limit}`;

    // Try to get paginated result from Redis cache
    const redisCars = await redisClient.get(redisKey);
    let allCars;

    if (redisCars) {
      allCars = JSON.parse(redisCars);
    } else {
      // Run aggregation with pagination
      allCars = await Car.aggregate([
        {
          $match: {},
        },
        {
          $lookup: {
            from: "reviews",
            localField: "_id",
            foreignField: "car",
            as: "reviews_data",
          },
        },
        {
          $addFields: {
            totalReviews: { $size: "$reviews_data" },
          },
        },
        { $skip: skip },
        { $limit: limit },
      ]);

      if (!allCars || allCars.length === 0) {
        res.status(404).json({
          success: false,
          message: "No cars found.",
        });
        return;
      }

      // Cache paginated result
      await redisClient.set(redisKey, JSON.stringify(allCars), {
        EX: 86400,
      });
    }

    // Optional: total count for pagination UI
    const totalCars = await Car.countDocuments();

    res.status(200).json({
      success: true,
      message: "Cars fetched successfully.",
      data: allCars,
      page,
      limit,
      totalPages: Math.ceil(totalCars / limit),
      totalCars,
    });
  } catch (error) {
    console.error("Error fetching cars:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching cars.",
    });
  }
}

/**
 * @route   POST /api/lease
 * @desc    Create a new lease agreement for a car
 * @access  Protected (requires authenticated user)
 */
export async function createLease(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;

  try {
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized. Please log in to create a lease.",
      });
      return;
    }

    type DateType = {
      startDate: string;
      endDate: string;
    };

    const { startDate, endDate } = req.body as DateType;
    const carId = req.params?.id as string;

    if (!carId || !startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: "carId, startDate, and endDate are required.",
      });
      return;
    }

    const redisUser = await redisClient.get(`carAvailable:${carId}`);
    let car;
    if (redisUser) {
      car = JSON.parse(redisUser);
      console.log("..");
    } else {
      car = await Car.findById(carId);
      console.log(".....");

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
        message: "This car is currently not available for lease.",
      });
      return;
    }

    // Enforce 7-day lease only
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

    const lease = await Lease.create({
      user: new mongoose.Types.ObjectId(userId),
      car: new mongoose.Types.ObjectId(carId),
      startDate: start,
      endDate: end,
      totalAmount,
      returnedDate: end,
      status: "pending",
    });

    // Optionally mark car unavailable
    await Car.updateOne({ _id: carId }, { available: false });

    const stripe = new Stripe(process.env.STRIPE_SERVER_KEY! as string, {
      apiVersion: "2025-05-28.basil",
    });

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount * 100),
      currency: "usd",
      payment_method_types: ["card"],
      metadata: {
        carId: carId,
        userId: userId,
        leaseId: String(lease._id),
      },
    });

    lease.paymentId = intent.id;
    await lease.save();
    car.available = false;
    await redisClient.set(`carAvailable:${carId}`, JSON.stringify(car), {
      EX: 86400,
    });
    await Car.findByIdAndUpdate(carId, { available: false });

    res.status(201).json({
      success: true,
      message: "Lease created successfully for 7 days.",
      data: lease,
      client_secret: intent.client_secret,
    });
  } catch (error) {
    console.error("Lease creation error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while creating lease.",
    });
  }
}

/**
 * @route   POST /api/lease/extend
 * @desc    Extend a lease by additional days and initiate payment
 * @access  Private
 */
export async function extendLease(req: Request, res: Response): Promise<void> {
  type Days = { additionalDays: number };
  const { additionalDays } = req.body as Days;
  const leaseId = req.params.id as string;
  const userId = req.user?.userId as string;

  try {
    if (!leaseId || !additionalDays || additionalDays <= 0) {
      res.status(400).json({
        success: false,
        message: "Valid leaseId and additionalDays are required.",
      });
      return;
    }

    const redisLease = await redisClient.get(`ExtendLease:${leaseId}`);
    let lease;
    if (redisLease) {
      lease = JSON.parse(redisLease);
    } else {
      lease = await Lease.findById(leaseId).populate("car");

      if (!lease) {
        res.status(404).json({
          success: false,
          message: "Lease not found.",
        });
        return;
      }
      await redisClient.set(`ExtendLease:${leaseId}`, JSON.stringify(lease), {
        EX: 86400,
      });
    }

    if (lease.user.toString() !== userId) {
      res.status(403).json({
        success: false,
        message: "Unauthorized to modify this lease.",
      });
      return;
    }

    const car = lease.car as any;

    const oldEndDate = new Date(lease.endDate);
    const newEndDate = new Date(oldEndDate);
    newEndDate.setDate(newEndDate.getDate() + additionalDays);

    // Check if lease has exactly 1 day left
    const now = new Date();
    const oneDayInMs = 24 * 60 * 60 * 1000;
    const timeLeft = new Date(lease.endDate).getTime() - now.getTime();

    if (timeLeft > oneDayInMs || timeLeft < 0) {
      res.status(400).json({
        success: false,
        message: "Lease can only be extended when 1 day is remaining.",
      });
      return;
    }

    const dailyRate = car.pricePerDay;
    const totalAmount = dailyRate * additionalDays * 100; // Stripe expects cents
    const stripe = new Stripe(process.env.STRIPE_SERVER_KEY! as string, {
      apiVersion: "2025-05-28.basil",
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: "usd",
      metadata: {
        leaseId: lease._id.toString(),
        carId: car._id.toString(),
        type: "lease_extension",
        userId,
      },
    });

    lease.endDate = newEndDate;
    lease.status = "pending";
    lease.returnedDate = newEndDate;
    await Lease.updateOne(
      { paymentId: lease.paymentId },
      { paymentId: paymentIntent.id }
    );
    await lease.save();
    await redisClient.set(`ExtendLease:${leaseId}`, JSON.stringify(lease), {
      EX: 86400,
    });

    res.status(200).json({
      success: true,
      message: `Lease extended by ${additionalDays} day(s). Payment required.`,
      lease: {
        id: lease._id,
        car: car._id,
        oldEndDate,
        newEndDate,
        dailyRate,
        additionalDays,
        totalAmount: totalAmount / 100,
        status: lease.status,
      },
      paymentIntentClientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.error("❌ Error during lease extension:", err);
    res.status(500).json({
      success: false,
      message: "Server error while extending lease.",
    });
  }
}

/**
 * @route   GET /api/payment/history
 * @desc    Get logged-in user's lease payment history
 * @access  Private
 */
export async function getPaymentDetails(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Unauthorized: user ID missing",
    });
    return;
  }

  try {
    const redisPaymentHistory = await redisClient.hGetAll(
      `leasePaymentHistory:${userId}`
    );
    let leases: any[] = [];
    if (Object.keys(redisPaymentHistory).length > 0) {
      leases = Object.values(redisPaymentHistory).map((item) =>
        JSON.parse(item)
      );
      console.log("..");
    } else {
      leases = await Lease.find({ user: userId }).populate("car");
      console.log(".....");

      if (!leases.length) {
        res.status(200).json({
          success: true,
          message: "No lease history found.",
          data: {
            totalLeases: 0,
            totalPending: 0,
            totalPaid: 0,
            totalCancelled: 0,
            totalAmountPaid: 0,
            leases: [],
          },
        });
        return;
      }
      const key = `leasePaymentHistory:${userId}`;
      const objHash: Record<string, string> = {};
      for (const lease of leases) {
        const leaseId = lease._id.toString();
        objHash[leaseId] = JSON.stringify(lease);
      }

      await redisClient.hSet(key, objHash);
      await redisClient.expire(key, 86400);
    }

    const totalPaid = leases.filter((l) => l.status === "completed").length;
    const totalCancelled = leases.filter((l) => l.status === "cancel").length;
    const totalPending = leases.filter((l) => l.status === "pending").length;
    const totalAmountPaid = leases
      .filter((l) => l.status === "completed")
      .reduce((sum, l) => sum + (l.totalAmount || 0), 0);

    res.status(200).json({
      success: true,
      message: "Lease payment history fetched successfully.",
      data: {
        totalLeases: leases.length,
        totalPaid,
        totalPending,
        totalCancelled,
        totalAmountPaid,
        leases: leases,
      },
    });
  } catch (err) {
    console.error("❌ Error fetching payment details:", err);
    res.status(500).json({
      success: false,
      message: "Server error while fetching payment history.",
    });
  }
}

/**
 * @route   POST /lease/:id/return
 * @desc    Allows a user to return a leased car
 * @access  Protected (requires authentication)
 */
export async function returnCar(req: Request, res: Response): Promise<void> {
  const leaseId = req.params.id;
  const userId = req.user?.userId;

  if (!leaseId || !userId) {
    res.status(400).json({
      success: false,
      message: "Lease ID and user authentication required.",
    });
    return;
  }

  try {
    const lease = await Lease.findById(leaseId);

    if (!lease) {
      res.status(404).json({ success: false, message: "Lease not found." });
      return;
    }

    if (lease.user.toString() !== userId) {
      res.status(403).json({
        success: false,
        message: "You are not authorized to return this car.",
      });
      return;
    }

    if (lease.isReturned) {
      res
        .status(400)
        .json({ success: false, message: "Car already returned." });
      return;
    }

    await Car.findByIdAndUpdate(lease.car, { available: true });

    lease.isReturned = true;
    lease.returnedDate = new Date();
    lease.status = "completed";
    await lease.save();
    await redisClient.set(`ExtendLease:${leaseId}`, JSON.stringify(lease), {
      EX: 86400,
    });
    await redisClient.hSet(
      `leasePaymentHistory:${userId}`,
      leaseId,
      JSON.stringify(lease)
    );
    await redisClient.expire(`leasePaymentHistory:${userId}`, 86400);
    const redisCar = await redisClient.get(`carAvailable:${lease.car}`);
    let car;
    if (redisCar) {
      car = JSON.parse(redisCar);
    }
    car.available = true;
    await redisClient.set(`carAvailable:${lease.car}`, JSON.stringify(car), {
      EX: 86400,
    });

    res.status(200).json({
      success: true,
      message: "Car successfully returned.",
      lease: {
        id: lease._id,
        returnedAt: lease.returnedDate,
        status: lease.status,
      },
    });
  } catch (error) {
    console.error("❌ Error returning car:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error while returning car." });
  }
}

/**
 * GET /api/brands
 * Fetches all unique car brands with their brand images.
 * Caches the result in Redis for faster subsequent access.
 */
export async function getAllBrands(req: Request, res: Response): Promise<void> {
  try {
    const redisBrands = await redisClient.get("carBrands");
    let brands;

    if (redisBrands) {
      brands = JSON.parse(redisBrands);
    } else {
      brands = await Car.aggregate([
        {
          $group: {
            _id: "$brand",
            brandImage: { $first: "$brandImage" },
          },
        },
        {
          $project: {
            _id: 0,
            brand: "$_id",
            brandImage: 1,
          },
        },
      ]);

      if (!brands || brands.length === 0) {
        res.status(404).json({
          success: false,
          message: "No brands found in the database.",
        });
        return;
      }

      await redisClient.set("carBrands", JSON.stringify(brands), { EX: 86400 });
    }

    res.status(200).json({
      success: true,
      message: "Car brands fetched successfully.",
      brands,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching car brands.",
      error: (error as Error).message,
    });
  }
}

// export async function searchBrandQuery(req: Request, res: Response): Promise<void> {
//   const query = req.query?.q as string;

//   const brands = await Car.aggregate([
//     {
//       $match: {
//         brand: {$regex: query, $options: "i"}
//       }
//     },
//     {
//       $group: {
//         _id: "$brand",
//         brandImage: {
//           $first: "$brandImage"
//         }
//       }
//     },
//     {
//       $project: {
//         _id: 0,
//         brand: "$_id",
//         brandImage: 1
//       }
//     }
//   ])
// }

//  Get lease details by ID, with Redis caching
export async function leaseDetails(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId as string;
  const leaseId = req.params.id as string;

  try {
    // Ensure user is authenticated
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Please login to view lease details.",
      });
      return;
    }

    // Ensure lease ID is provided
    if (!leaseId) {
      res
        .status(400)
        .json({ success: false, message: "Lease ID is required." });
      return;
    }

    // Try fetching lease details from Redis cache
    const redisLeaseDetails = await redisClient.hGetAll(
      `leaseDetails:${leaseId}`
    );

    let leaseDetails;
    if (Object.keys(redisLeaseDetails).length > 0) {
      leaseDetails = redisLeaseDetails;
    } else {
      //  Cache miss — Fetch from MongoDB using aggregation
      leaseDetails = await Lease.aggregate([
        {
          $match: { _id: new mongoose.Types.ObjectId(leaseId) },
        },
        {
          $lookup: {
            from: "cars",
            localField: "car",
            foreignField: "_id",
            as: "carDetails",
          },
        },
      ]);

      // Store in Redis for caching
      const key = `leaseDetails:${leaseId}`;
      const objHash: Record<string, string> = {};

      for (const [key, value] of Object.entries(leaseDetails[0] || {})) {
        objHash[key] =
          typeof value === "object" ? JSON.stringify(value) : String(value);
      }

      await redisClient.hSet(key, objHash);
      await redisClient.expire(key, 86400);
    }

    res.status(200).json({
      success: true,
      message: "Lease details fetched successfully.",
      data: leaseDetails,
    });
  } catch (error) {
    console.error("Error in leaseDetails:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
}


// Controller: Fetch all FAQs with Redis caching
export async function getAllFAQs(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;

  try {
    const redisFaqs = await redisClient.get(`Faqs:AllFAQs`);
    let faqs;
    if (redisFaqs) {
      faqs = JSON.parse(redisFaqs);
    } else {
      faqs = await Faq.find();
      if (!faqs) {
        res.status(400).json({ success: false, message: "No FAQs found." });
        return;
      }

      await redisClient.setEx(`Faqs:AllFAQs`, 86400, JSON.stringify(faqs));
    }

    res.status(200).json({
      success: true,
      message: "Faqs fetched successfully",
      data: faqs,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error!" });
  }
}



/**
 * @route   GET /api/policy
 * @desc    Fetch privacy and terms policy for the authenticated user
 * @access  Private
 */
export async function getAllPolicy(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;

  
  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Unauthorized access. Please log in.",
    });
    return;
  }

  try {
  
    const cachedPolicy = await redisClient.get("policy:policy");
    let policy;

    if (cachedPolicy) {
      policy = JSON.parse(cachedPolicy);
    } else {
      
      policy = await Policy.find();

      if (!policy || policy.length === 0) {
        res.status(404).json({
          success: false,
          message: "No privacy or terms policy found in the database.",
        });
        return;
      }

    
      await redisClient.setEx("policy:policy", 86400, JSON.stringify(policy));
    }

  
    res.status(200).json({
      success: true,
      message: "Privacy and Terms policy retrieved successfully.",
      data: policy,
    });
  } catch (error) {
    console.error("Policy fetch error:", error);
    res.status(500).json({
      success: false,
      message: "An unexpected error occurred while fetching policy.",
    });
  }
}



/**
 * @route   POST /api/report-issue
 * @desc    Report an issue from a logged-in user
 * @access  Private
 */
export async function reportIssue(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const { email, description } = req.body;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Unauthorized access. Please log in to report an issue.",
    });
    return;
  }


  if (!email || !description) {
    res.status(400).json({
      success: false,
      message: "email and description are required.",
    });
    return;
  }

  try {
    const issue = new IssueReport({
      user: userId,
      email,
      description,
    });

    await issue.save();

    res.status(201).json({
      success: true,
      message: "Issue reported successfully.",
      data: issue,
    });
  } catch (error) {
    console.error("Report Issue Error:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while reporting the issue.",
    });
  }
}
