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
import { signupSchema } from "../../lib/zod/zod.signup";
import { emailQueue } from "../../lib/mail/emailQueues";
import { loginSchema } from "../../lib/zod/zod.login";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { resetPassSchema } from "../../lib/zod/zod.resetPass";
import mongoose from "mongoose";

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user
 * @access  Public
 */

export async function adminSignup(req: Request, res: Response): Promise<void> {
  try {
    const parsed = signupSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message:
          "Some input fields are missing or incorrect. Please review and try again.",
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { fullName, email, password } = parsed.data;

    const firstAdmin = await User.countDocuments({ role: "admin" });
    if (firstAdmin > 0) {
      res.status(400).json({ success: false, message: "Admin already exist" });
      return;
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "User already exists with this email.",
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: fullName,
      email,
      password: hashedPassword,
      role: "admin",
    });

    if (!user) {
      res.status(409).json({
        success: false,
        message: "User not created.",
      });
      return;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await redisClient.setEx(`verifyEmail:code`, 600, code);
    await redisClient.setEx(`user:${email}`, 86400, JSON.stringify(user));
    await emailQueue.add(
      "verifyEmailOtp",
      { code, to: email },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      }
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again.",
      error,
    });
  }
}

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return JWT token
 * @access  Public
 **/
export async function adminLogin(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message:
        "Some input fields are missing or incorrect. Please review and try again.",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { email, password } = parsed.data;

  if (!email || !password) {
    res
      .status(400)
      .json({ success: false, message: "Email and password are required." });
    return;
  }

  try {
    const userInRedis = await redisClient.get(`user:${email}`);
    let user;
    if (userInRedis) {
      user = JSON.parse(userInRedis);
    } else {
      user = await User.findOne({ email });
      if (!user) {
        res.status(400).json({ success: false, message: "user not found" });
        return;
      }
      await redisClient.set(`user:${email}`, JSON.stringify(user), {
        EX: 86400,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ success: false, message: "Invalid credentials" });
      return;
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    res
      .cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .status(200)
      .json({
        success: true,
        message: "Login successful.",
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          token: token,
        },
      });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
}

/**
 * @route   POST /api/auth/logout
 * @desc    Logs out user by instructing client to delete token
 * @access  Public
 **/
export async function userLogout(req: Request, res: Response): Promise<void> {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.status(200).json({ success: true, message: "Logout successful." });
}

/**
 * @route   POST admin auth verify email
 * @desc    Verifies the 6-digit code sent to user's email
 * @access  Public
 */
export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const { email, code } = req.body;

  if (!email || !code) {
    res
      .status(400)
      .json({ success: false, message: "Email and code are required." });
    return;
  }

  try {
    const redisCode = await redisClient.get(`verifyEmail:code`);
    let rCode;
    if (redisCode) {
      rCode = JSON.parse(redisCode);
    }

    if (rCode !== code) {
      res
        .status(400)
        .json({ success: false, message: "verification code doesn't match." });
      return;
    }

    const updatedUser = await User.findOneAndUpdate(
      { email: email },
      {
        $set: { isVerified: true },
      },
      { new: true }
    );

    if (!updatedUser) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }

    await redisClient.setEx(
      `user:${email}`,
      86400,
      JSON.stringify(updatedUser)
    );

    res
      .status(200)
      .json({ success: true, message: "Email verified successfully." });
  } catch (error) {
    console.error("Verification error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to verify email." });
  }
}

/**
 * @route   POST /api/auth/resend-otp
 * @desc    Resends a 6-digit email verification code to the authenticated user
 * @access  Private
 */
export async function resendEmailOtp(
  req: Request,
  res: Response
): Promise<void> {
  const { email } = req.body as { email: string };

  if (!email) {
    res.status(401).json({
      success: false,
      message: "Unauthorized. Please login first.",
    });
    return;
  }

  try {
    const redisUser = await redisClient.get(`user:${email}`);
    let user;
    if (redisUser) {
      user = JSON.parse(redisUser);
    } else {
      user = await User.findOne({ email });
      if (!user) {
        res.status(400).json({
          success: false,
          message: "User not found.",
        });
        return;
      }
      await redisClient.setEx(`user:${email}`, 86400, JSON.stringify(user));
    }

    if (user?.isVerified) {
      res.status(400).json({
        success: false,
        message: "Email is already verified.",
      });
      return;
    }

    const newCode = Math.floor(100000 + Math.random() * 900000);

    await redisClient.setEx(`verifyEmail:code`, 300, JSON.stringify(newCode));

    await emailQueue.add(
      "resendEmailOtp",
      { code: newCode, to: email },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      }
    );

    res.status(200).json({
      success: true,
      message: "Verification code resent to your email.",
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resend verification code.",
    });
  }
}

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Initiates forgot password process by generating a reset token and sending it to user's email
 * @access  Public
 */
export async function forgotPassword(
  req: Request,
  res: Response
): Promise<void> {
  type Email = {
    email: string;
  };

  const { email } = req.body as Email;

  if (!email) {
    res.status(400).json({ success: false, message: "Email is required." });
    return;
  }

  try {
    const redisUser = await redisClient.get(`user:${email}`);
    let user;
    if (redisUser) {
      user = JSON.parse(redisUser);
    } else {
      user = await User.findOne({ email });
      if (!user) {
        res.status(200).json({
          success: false,
          message: "User not found.",
        });
        return;
      }

      await redisClient.setEx(`user:${email}`, 86400, JSON.stringify(user));
    }

    const newCode = Math.floor(100000 + Math.random() * 900000);
    await redisClient.setEx(
      `forgotPasswordOtp:code`,
      300,
      JSON.stringify(newCode)
    );
    await emailQueue.add(
      "resendEmailOtp",
      { code: newCode, to: email },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      }
    );

    res.status(200).json({
      success: true,
      message: "verification code successfully sent to your email",
    });
  } catch (error) {
    console.error("Forgot Password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process password reset request.",
    });
  }
}

export async function matchOtp(req: Request, res: Response): Promise<void> {
  const { email, code } = req.body;
  try {
    if (!email || !code) {
      res.status(400).json({
        success: false,
        message: "verification code and email is required",
      });
      return;
    }
    const redisCode = await redisClient.get(`forgotPasswordOtp:code`);
    let rCode;
    if (redisCode) {
      rCode = JSON.parse(redisCode);
    }
    if (rCode !== code) {
      res
        .status(400)
        .json({ success: false, message: "password doesn't matched" });
      return;
    }

    res
      .status(200)
      .json({ success: true, message: "password matched successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "internal server error" });
  }
}

/**
 * @route   POST /api/auth/reset-password
 * @desc    Resets user's password using email
 * @access  Public
 */
export async function resetPassword(
  req: Request,
  res: Response
): Promise<void> {
  const parsed = resetPassSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Validation error",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { email, newPassword, reNewPassword } = parsed.data;

  if (newPassword !== reNewPassword) {
    res
      .status(400)
      .json({ success: false, message: "please enter correct password!" });
    return;
  }

  if (!email || !newPassword || !reNewPassword) {
    res.status(400).json({
      success: false,
      message: "Email and new password are required.",
    });
    return;
  }

  try {
    const redisUser = await redisClient.get(`user:${email}`);
    let user;
    if (redisUser) {
      user = JSON.parse(redisUser);
    } else {
      user = await User.findOne({ email });

      if (!user) {
        res.status(400).json({
          success: false,
          message: "Invalid or expired password reset token.",
        });
        return;
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updatedUser = await User.findOneAndUpdate(
      { email },
      {
        $set: { password: hashedPassword },
      },
      { new: true }
    );
    if (!updatedUser) {
      res.status(400).json({ success: false, message: "User not found" });
      return;
    }
    await redisClient.setEx(
      `user:${email}`,
      86400,
      JSON.stringify(updatedUser)
    );

    res.status(200).json({
      success: true,
      message: "Password has been reset successfully.",
    });
  } catch (error) {
    console.error("Reset Password error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to reset password." });
  }
}

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
  const userId = req.user?.userId;
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
  const userId = req.user?.userId;
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
  const userId = req.user?.userId;
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
  const userId = req.user?.userId;

  try {
    if (!userId) {
      res
        .status(400)
        .json({ success: false, message: "Unauthorized please login first" });
      return;
    }

    const users = await User.find().lean();

    if (!users) {
      res.status(400).json({ success: false, message: "Users not found" });
      return;
    }

    const updatedUser = await Promise.all(
      users.map(async (itm) => {
        const totalLeases = await Lease.countDocuments({ user: itm._id });
        if (itm._id) {
          if (itm._id.toString() === userId.toString()) {
            return {
              ...itm,
              totalLeases,
            };
          }
        }
        return itm;
      })
    );

    res.status(200).json({ success: true, users: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: "internal server error" });
  }
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  const userid = req.user?.userId;
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
      res.status(400).json({ success: false, message: "User nt found" });
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
  const userId = req.user?.userId;
  const { id } = req.params;
  try {
    if (!userId) {
      res
        .status(400)
        .json({ success: false, message: "Unauthorized please login first" });
      return;
    }

    const userDetailss = await User.findById(id);

    if (!userDetailss) {
      res.status(400).json({ success: false, message: "User not found" });
      return;
    }

    const totalLeases = await Lease.find({
      user: userDetailss._id,
    });

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
    res.status(500).json({ success: false, message: "internal server error" });
  }
}
