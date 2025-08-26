import { Request, Response } from "express";
import { createCarSchema } from "../../lib/zod/zod.car.listing";
import { Car } from "../../models/car.model";
import { Lease } from "../../models/Lease.model";
import { v2 as cloudinary } from "cloudinary";
import { redisClient } from "../../lib/redis/redis";
import { Faq } from "../../models/faqs.model";
import { Policy } from "../../models/policy.model";
import { log } from "console";

interface CloudinaryFile extends Omit<Express.Multer.File, "path"> {
  path?: string;
  secure_url?: string;
  filename: string;
}

type MulterFiles = {
  images?: CloudinaryFile[];
  brandImage?: CloudinaryFile[];
};

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
  const images = files["images"]?.map(file => file.path) || [];
  const brandImage = files["brandImage"]?.[0]?.path || null;
  console.log(images);
  console.log(brandImage);

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

  await redisClient.del(`cars`);
  res.status(200).json({
    success: true,
    message: "Car registered successfully",
    car: JSON.parse(JSON.stringify(car)),
  });
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

    // ✅ Delete images from Cloudinary
    for (const image of car?.images || []) {
      if (image.public_id) {
        await cloudinary.uploader.destroy(image.public_id);
      }
    }

    // ✅ Delete brand image
    if (car.brandImage?.public_id) {
      await cloudinary.uploader.destroy(car.brandImage.public_id);
    }

    // ✅ Delete the car from the DB
    await Car.findByIdAndDelete(carId);

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
