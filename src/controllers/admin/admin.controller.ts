import { Request, Response } from "express";
import { createCarSchema } from "../../lib/zod/zod.car.listing";
import { Car } from "../../models/car.model";
import { Lease } from "../../models/Lease.model";
import { redisClient } from "../../lib/redis/redis";
import { Faq } from "../../models/faqs.model";
import { Policy } from "../../models/policy.model";
import fs from "fs";
import { AdminActivity } from "../../models/adminActivity";
import { User } from "../../models/user.model";
import path from "path";
import { IssueReport } from "../../models/report.model";
import { createUpdateCarSchema } from "../../lib/zod/zod.update.car";
import { resolveSoa } from "dns";


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
    year: Number(year),
    color,
    price: Number(price),
    passengers: Number(passengers),
    doors: Number(doors),
    airCondition: Boolean(airCondition),
    maxPower: Number(maxPower),
    mph: Number(mph),
    topSpeed: Number(topSpeed),
    available: true,
    tax: Number(tax),
    weeklyRate: Number(weeklyRate),
    pricePerDay: Number(pricePerDay),
    initialMileage: Number(initialMileage),
    allowedMilleage: Number(allowedMilleage),
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
  req.io.emit("brandAdded", brands);
  req.io.emit("carAdded", car);
  await redisClient.setEx("AllBrands:AllBrands", 86400, JSON.stringify(brands));
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
        const fileName = path.basename(imgPath);
        const filePath = path.join("/var/www/private_data/uploads/", fileName);

        fs.unlink(filePath, (err) => {
          if (err)
            console.error("❌ Failed to delete image:", filePath, err.message);
          else console.log("✅ Image deleted:", filePath);
        });
      });
    }

    await Car.findByIdAndDelete(carId);
    await redisClient.del(`AllBrands:AllBrands`);
    await redisClient.del(`AllCars:AllCars`);
    await redisClient.del(`carDetails:${carId}`);
    req.io.emit("carDeleted", { carId });

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
  const userId = req.user?._id;
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
  const userId = req.user?._id;
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

export async function recentActivity(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const activities = await AdminActivity.find();
    if (!activities) {
      res.status(400).json({ success: false, message: "activities not founs" });
      return;
    }
    res.json({ success: true, activities });
  } catch (err) {
    console.error("❌ Error fetching admin activities:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch activities" });
  }
}

export async function totalUsers(req: Request, res: Response): Promise<void> {
  try {
    const users = await User.countDocuments();

    if (!users) {
      res.status(400).json({ success: false, message: "No user in DB" });
      return;
    }

    res.status(200).json({ success: true, users });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "failed to fetch users" });
  }
}

export async function totalCars(req: Request, res: Response): Promise<void> {
  try {
    const cars = await Car.countDocuments();

    if (!cars) {
      res.status(400).json({ success: false, message: "cars not found" });
      return;
    }

    res.status(200).json({ success: true, cars });
  } catch (error) {
    res.status(500).json({ success: false, message: "failed to fetch cars" });
  }
}

export async function activeLeases(req: Request, res: Response): Promise<void> {
  try {
    const leases = await Lease.find({
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    });
    if (!leases) {
      res.status(400).json({ success: false, message: "no lease found" });
      return;
    }

    res.status(200).json({ success: true, leases });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "failed to fetch active leases" });
  }
}

export async function getOneWeekAllCars(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user?._id;
  try {
    if (!userId) {
      res
        .status(400)
        .json({ success: false, message: "unauthorized please login first" });
      return;
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const recentCars = await Car.find({
      createdAt: { $gte: oneWeekAgo },
    }).sort({ createdAt: -1 });

    if (!recentCars) {
      res.status(400).json({ success: false, message: "cars not found" });
      return;
    }

    res.status(200).json({ success: true, cars: recentCars });
  } catch (error) {
    res.status(500).json({ success: false, message: "internal server error" });
  }
}

export async function getOneWeekUsers(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user?._id;
  try {
    if (!userId) {
      res
        .status(400)
        .json({ success: false, message: "Unauthorized please login first" });
      return;
    }

    const now = new Date();
    now.setDate(now.getDate() - 7);

    const users = await User.find({
      createdAt: { $gte: now },
    }).sort({ createdAt: -1 });

    if (!users) {
      res.status(400).json({ success: false, message: "Users not found" });
      return;
    }

    res.status(200).json({ success: false, users });
  } catch (error) {
    res.status(500).json({ success: false, message: "internal server error" });
  }
}

export async function activeUsers(req: Request, res: Response): Promise<void> {
  const userId = req.user?._id;
  try {
    if (!userId) {
      res
        .status(400)
        .json({ success: false, message: "Unauthorized please login first" });
      return;
    }

    const users = await Lease.find({
      status: "active",
    }).distinct("user");

    const result = await User.find({
      _id: { $in: users },
    });

    if (!result) {
      res
        .status(400)
        .json({ success: false, message: "active users not found" });
      return;
    }

    res.status(200).json({ success: false, users: result });
  } catch (error) {
    res.status(500).json({ success: false, message: "internal server error" });
  }
}

export async function AllUsers(req: Request, res: Response): Promise<void> {
  try {
    const users = await User.find({ role: { $ne: "admin" } }).lean();

    if (!users || users.length === 0) {
      res.status(400).json({ success: false, message: "Users not found" });
      return;
    }

    const updatedUsers = await Promise.all(
      users.map(async (u) => {
        const totalLeases = await Lease.countDocuments({ user: u._id });
        return { ...u, totalLeases };
      })
    );

    res.status(200).json({ success: true, users: updatedUsers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "internal server error" });
  }
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  const userid = req.user?._id;
  const { id } = req.params;
  try {
    if (!userid) {
      res
        .status(400)
        .json({ success: false, message: "Unauthorized please login first" });
      return;
    }

    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      res.status(400).json({ success: false, message: "User not found" });
      return;
    }
    const leasesUser = await Lease.find({ user: deletedUser._id });
    const carIds = leasesUser.map((lease: any) => lease.car);

    await Car.updateMany(
      {
        _id: { $in: carIds },
      },
      { $set: { available: true } }
    );

    req.io.emit("userDeleted", {
      id,
      message: "Your account has been deleted by admin.",
    });

    await Lease.deleteMany({
      user: deletedUser._id,
    });
    await redisClient.del(`AllCars:AllCars`);
    await redisClient.del(`leases:${deletedUser._id}`);
    await redisClient.del(`user:${deletedUser.email}`);
  } catch (error) {
    res.status(500).json({ success: false, message: "internal server error" });
  }
}

export async function userDetails(req: Request, res: Response): Promise<void> {
  const userId = req.user?._id
  const { id } = req.params;
  try {
    if (!userId) {
      res
        .status(400)
        .json({ success: false, message: "Unauthorized please login first" });
      return;
    }
    console.log(id, userId);
    const userDetailss = await User.findById(id);

    if (!userDetailss) {
      res.status(400).json({ success: false, message: "User not found" });
      return;
    }

    const totalLeases = await Lease.find({
      user: userDetailss._id,
    }).populate("car");

    if (!totalLeases) {
      res.status(400).json({ success: false, message: "Leases not found" });
      return;
    }

    const leasesLength = totalLeases.length;
    const totalPaid = totalLeases.reduce(
      (accu, lease) => accu + Number(lease.totalAmount),
      0
    );
    const activeLeases = totalLeases.filter(
      (lease: any) => lease.status === "active"
    );
    const completedLeases = totalLeases.filter(
      (lease: any) => lease.status === "expired"
    );

    res.status(200).json({
      success: true,
      LeasesLength: leasesLength,
      userDetailss,
      totalPaid,
      activeLeases,
      completedLeases,
    });
  } catch (error) {
    console.log(error);
    
    res.status(500).json({ success: false, message: "internal server error" });
  }
}

export async function totalCarss(req: Request, res: Response): Promise<void> {
  const userId = req.user?._id;
  try {
    if (!userId) {
      res
        .status(400)
        .json({ success: false, message: "Unauthorized please login first" });
      return;
    }
    const cars = await Car.find();
    if (!cars) {
      res.status(400).json({ success: false, message: "cars not found" });
      return;
    }

    const totalLeased = await Lease.find();

    const totalCarsWithTotalLeases = cars.map((car) => {
      const totalLeases = totalLeased.filter(
        (l) => l.car.toString() === car?._id
      ).length;
      return { ...car.toObject(), totalLeases };
    });

    const carsLeased = cars.filter((c) => c.available === false);
    const availableCars = cars.filter((c) => c.available === true);

    res.status(200).json({
      success: true,
      cars,
      carsLeased,
      availableCars,
      totalCarsWithTotalLeases,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "internal server error" });
  }
}

export async function carDetails(req: Request, res: Response): Promise<void> {
  const userId = req.user?._id;
  const { id } = req.params;

  try {
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized — please login first",
      });
      return;
    }

    if (!id) {
      res.status(400).json({
        success: false,
        message: "Please provide a car ID to fetch details",
      });
      return;
    }

    const carDetails = await Car.findById(id);
    if (!carDetails) {
      res.status(404).json({ success: false, message: "Car not found" });
      return;
    }

    const currentCarLeases = await Lease.find({ car: id }).populate("user");

    const totalRevenue = currentCarLeases.reduce(
      (acc, curr) => acc + (curr.totalAmount || 0),
      0
    );

    const activeLease = currentCarLeases.filter((l) => l.status === "active");

    res.status(200).json({
      success: true,
      carDetails,
      totalRevenue,
      totalLeases: currentCarLeases.length,
      activeLease,
    });
  } catch (error) {
    console.error("Error fetching car details:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

export async function userComplains(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user?._id;
  try {
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized — please login first",
      });
      return;
    }

    const redisComplain = await redisClient.get(`complains:complains`);
    let complains;
    if (redisComplain) {
      complains = JSON.parse(redisComplain);
    } else {
      complains = await IssueReport.find().populate("userId");

      if (!complains) {
        res.status(401).json({
          success: false,
          message: "No complains yet!",
        });
        return;
      }
      await redisClient.setEx(
        `complains:complains`,
        86400,
        JSON.stringify(complains)
      );
    }

    res.status(200).json({ success: false, complains });
  } catch (error) {
    res.status(500).json({ success: false, message: "internal server error" });
  }
}

export async function transactions(req: Request, res: Response): Promise<void> {
  const userId = req.user?._id;
  try {
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized — please login first",
      });
      return;
    }
    const leases = await Lease.find().populate("user").populate("car");
    if (!leases) {
      res
        .status(401)
        .json({ success: false, message: "No transactions found" });
      return;
    }
    const totalRevenue = leases.reduce(
      (accu, curr) => accu + curr.totalAmount,
      0
    );
    const totalTransactions = leases.length;

    res
      .status(200)
      .json({ success: true, leases, totalTransactions, totalRevenue });
  } catch (error) {
    res.status(500).json({ success: false, message: "internal server error" });
  }
}

export async function updateCar(req: Request, res: Response): Promise<void> {
  const userId = req.user?._id;
  const {id} = req.params;
  try {
    
    const parsed = createUpdateCarSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Unautorized for update this car" });
      return;
    }

    
    const updatedCar = await Car.findByIdAndUpdate(id, { $set: parsed.data },{new: true});

    if (!updatedCar) {
      res.status(400).json({ success: false, message: "Car updation failed" });
      return;
    }

    res
      .status(200)
      .json({ success: true, message: "Car updated successfully", updatedCar });

    req.io.emit('carUpdated', updatedCar);
    await redisClient.del(`AllCars:AllCars`);
    await redisClient.del(`carDetails:${id}`);  



  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}


export  async function getPendingAdminUsers (req: Request, res: Response):Promise<void> {
  try {
    const userId = req.user?._id
    if (!userId) {
      res.status(401).json({success: false, message:"Unautorized please login first to access this route"})
      return
    }
    const users = await User.find({ source: "admin", status: "pending" });
    res.status(200).json({ success: true, users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};



/**
 * Returns the current user's email, _id, role, and status
 */
export const getAdminStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { _id } = user;

    const dbUser = await User.findById(_id);

    if (!dbUser) {
      res.status(401).json({success: false, message:"user not found"})
      return
    }

    res.status(200).json({
      success: true,
      user: { _id: dbUser._id, email: dbUser.email , role: dbUser.role, status: dbUser.status },
    });
  } catch (error: any) {
    console.error("Error fetching user status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export async function adminApprove(req: Request, res: Response): Promise<void> {
  try {
    const {id} = req.params;
    if (!id) {
      res.status(401).json({success: false, message:"please provide user ID"})
      return;
    }

    const user = await User.findById(id);
    if (!user) {
      res.status(401).json({success: false, message:"user not found"})
      return;
    }

    user.status = 'approved'
    user.role = 'admin'

    await user.save()
    
  } catch (error) {
    res.status(500).json({success: false, message:"internal server error"})
  }
}


export async function adminDisApproved(req: Request, res: Response): Promise<void> {
  try {
    const {id} = req.params;
    if (!id) {
      res.status(401).json({success: false, message:"please provide user ID"})
      return;
    }

    const user = await User.findById(id);
    if (!user) {
      res.status(401).json({success: false, message:"user not found"})
      return;
    }

    user.status = 'pending'
    user.role = 'user'

    await user.save()
    
  } catch (error) {
    res.status(500).json({success: false, message:"internal server error"})
  }
}