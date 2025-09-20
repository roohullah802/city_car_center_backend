import { Request, Response } from "express";
import { createCarSchema } from "../../lib/zod/zod.car.listing";
import { Car } from "../../models/car.model";
import { Lease } from "../../models/Lease.model";
import { redisClient } from "../../lib/redis/redis";
import { Faq } from "../../models/faqs.model";
import { Policy } from "../../models/policy.model";
import fs from "fs";

export async function carListing(req: Request, res: Response): Promise<void> {
  const parsed = createCarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Validation error",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const BASE_URL = "https://api.citycarcenters.com/uploads/";
  const images = files["images"]?.map((file) => BASE_URL + file.filename) || [];
  const brandImage = files["brandImage"]?.[0]
    ? BASE_URL + files["brandImage"][0].filename
    : null;

  const {
    brand,
    modelName,
    year,
    color,
    price,
    passengers,
    doors,
    airCondition,
    maxPower,
    mph,
    topSpeed,
    available,
    tax,
    weeklyRate,
    pricePerDay,
    initialMileage,
    allowedMilleage,
    fuelType,
    transmission,
    description,
  } = parsed.data;

  const car = await Car.create({
    brand: brand.toLocaleLowerCase(),
    modelName: modelName.toLocaleLowerCase(),
    year,
    color,
    price,
    passengers,
    doors,
    airCondition,
    maxPower,
    mph,
    topSpeed,
    available,
    tax,
    weeklyRate,
    pricePerDay,
    initialMileage,
    allowedMilleage,
    fuelType,
    transmission,
    description,
    brandImage,
    images,
  });

  await redisClient.del(`AllCars:AllCars`);
  res.status(200).json({
    success: true,
    message: "Car registered successfully",
    car: JSON.parse(JSON.stringify(car)),
  });
  const brands = await Car.aggregate([
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
  req.io.emit('brandAdded', brands);
  req.io.emit("carAdded", car);
}

/**
 * Deletes a lease by its ID, updates the associated car to be available again.
 */
export async function deleteLease(req: Request, res: Response): Promise<void> {
  const leaseId = req.params?.id as string;

  if (!leaseId) {
    res.status(400).json({ success: false, message: "Lease ID is required." });
    return;
  }

  const lease = await Lease.findById(leaseId);

  if (!lease) {
    res.status(404).json({ success: false, message: "Lease not found." });
    return;
  }

  await Car.findByIdAndUpdate(lease.car, { available: true });

  await Lease.findByIdAndDelete(leaseId);

  res.status(200).json({
    success: true,
    message: "Lease successfully deleted. Car is now available.",
  });
}

export async function deleteCarListing(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const carId = req.params.id;
    if (!carId) {
      res.status(404).json({ success: false, message: "CarId not found" });
      return;
    }

    const car = await Car.findById(carId);
    if (!car) {
      res.status(404).json({ success: false, message: "Car not found" });
      return;
    }

    if (car.images && car.images.length > 0) {
      let images: string[] = [];

      if (typeof car.images === "string") {
        images = JSON.parse(car.images);
      } else if (Array.isArray(car.images)) {
        images = car.images;
      }

      images.forEach((imgPath: string) => {
        fs.unlink(imgPath, (err) => {
          if (err) console.log("failed to delete image", imgPath, err);
          else console.log("image deleted", imgPath);
        });
      });
    }

    await Car.findByIdAndDelete(carId);

    await redisClient.del(`AllCars:AllCars`);
    await redisClient.del(`carDetails:${carId}`);

    res
      .status(200)
      .json({ success: true, message: "Car and images deleted successfully" });
  } catch (error) {
    console.error("Error deleting car:", error);
    res.status(500).json({ success: false, message: "Server error", error });
  }
}

/**
 * @desc   Add a single FAQ to the database
 * @route  POST /api/faqs
 * @access Protected (requires authentication)
 */
export async function setFAQs(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const { question, answer } = req.body;

  if (!userId) {
    res.status(400).json({ success: false, message: "User not authorized" });
    return;
  }
  if (!question || !answer) {
    res.status(400).json({
      success: false,
      message: "Please provide both question and answer.",
    });
    return;
  }

  try {
    const faq = await Faq.insertOne({
      question: question,
      answer: answer,
    });

    if (!faq) {
      res.status(400).json({ success: false, message: "FAQs not inserted!" });
      return;
    }

    await redisClient.del("Faqs:AllFAQs");
    res.status(200).json({ success: true, message: "FAQ added successfully." });
  } catch (error) {
    res.status(400).json({ success: false, message: "Interval server error!" });
    return;
  }
}

// Controller to set or create a Privacy Policy document
export async function setPrivacypolicy(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user?.userId;
  const { title, description } = req.body;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Unauthorized user. Please login to perform this action.",
    });
    return;
  }

  if (!title || !description) {
    res.status(400).json({
      success: false,
      message: "Please provide both title and description.",
    });
    return;
  }

  try {
    const data = await Policy.insertMany([
      {
        title: title,
        content: description,
      },
    ]);

    if (!data || data.length === 0) {
      res.status(400).json({
        success: false,
        message: "Failed to add Privacy Policy.",
      });
      return;
    }

    // Invalidate Redis cache so new policy gets fetched next time
    await redisClient.del(`policy:policy`);

    res.status(200).json({
      success: true,
      message: "Privacy Policy added successfully.",
      data: data[0],
    });
  } catch (error) {
    console.error("Error while setting privacy policy:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
}
