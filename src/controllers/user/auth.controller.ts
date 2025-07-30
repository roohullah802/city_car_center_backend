import dotenv from "dotenv";
dotenv.config();
import { Request, Response } from "express";
import { redisClient } from "../../lib/redis/redis";
import { signupSchema } from "../../lib/zod/zod.signup";
import { User } from "../../models/user.model";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendEmail } from "../../lib/mail/nodemailer";
import { loginSchema } from "../../lib/zod/zod.login";
import { resetPassSchema } from "../../lib/zod/zod.resetPass";
import { sendVerificationEmail } from "../../lib/mail/verification.email";


/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user
 * @access  Public
 */

export async function userSignup(req: Request, res: Response): Promise<void> {
  try {
    const parsed = signupSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { firstName, lastName, email, phoneNo, password } = parsed.data;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "User already exists with this email.",
      });
      return;
    }

    const user = new User({
      firstName,
      lastName,
      email,
      phoneNo,
      password,
    });

    if (!user) {
      res.status(409).json({
        success: false,
        message: "User not created.",
      });
      return;
    }

    const code = Math.floor(100000 + Math.random() * 900000);

    user.verificationCode = code;
    await user.save();

    await sendEmail(email, code);
    await redisClient.setEx(`user:${email}`, 86400, JSON.stringify(user));

    res.status(201).json({
      success: true,
      message: "User registered successfully.",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNo: user.phoneNo,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again.",
    });
  }
}

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return JWT token
 * @access  Public
 **/
export async function userLogin(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Validation error",
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
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    res
      .cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      })
      .status(200)
      .json({
        success: true,
        message: "Login successful.",
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNo: user.phoneNo,
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
 * @route   POST /api/auth/verify-email\
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
    const redisUser = await redisClient.get(`user:${email}`);
    let user;
    if (redisUser) {
      user = JSON.parse(redisUser);
    } else {
      user = await User.findOne({ email });
      if (!user) {
        res.status(404).json({ success: false, message: "User not found." });
        return;
      }
    }

    if (user?.verificationCode !== code) {
      res.status(400).json({
        success: false,
        message: "Invalid or expired verification code.",
      });
      return;
    }

    user.verificationCode = "";
    user.isVerified = true;
    await redisClient.set(`user:${email}`, JSON.stringify(user), {
      EX: 86400,
    });

    await User.findOneAndUpdate(
      { email: email },
      {
        $set: { isVerified: true },
        $unset: { verificationCode: "" },
      },
      { new: true }
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
    let user;
    const redisUser = await redisClient.get(`user:${email}`);

    if (redisUser) {
      user = JSON.parse(redisUser);
    } else {
      user = await User.findOne({ email });
      if (!user) {
        res.status(404).json({ success: false, message: "User not found." });
        return;
      }
    }

    if (user.isVerified) {
      res.status(400).json({
        success: false,
        message: "Email is already verified.",
      });
      return;
    }

    const newCode = Math.floor(100000 + Math.random() * 900000);

    user.verificationCode = newCode;

    await redisClient.set(`user:${email}`, JSON.stringify(user), {
      EX: 900,
    });

    if (!user.save) {
      user = User.hydrate(user);
    }

    await user.save();

    await sendVerificationEmail(email, newCode);

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
    const redisUsr = await redisClient.get(`user:${email}`);
    let user;
    if (redisUsr) {
      user = JSON.parse(redisUsr);
    } else {
      user = await User.findOne({ email });

      if (!user) {
        res.status(200).json({
          success: true,
          message: "If the email exists, a reset link has been sent.",
        });
        return;
      }
    }

    const newCode = Math.floor(100000 + Math.random() * 900000);

    user.verificationCode = newCode;
    await redisClient.set(`user:${email}`, JSON.stringify(user), {
      EX: 86400,
    });
    await User.findOneAndUpdate(
      { email },
      {
        $set: { verificationCode: newCode },
      },
      { new: true }
    );
    await sendVerificationEmail(email, newCode);

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

  if (!email || !code) {
    res.status(400).json({
      success: false,
      message: "verification code and email is required",
    });
    return;
  }
  const redisUser = await redisClient.get(`user:${email}`);
  let user;
  if (redisUser) {
    user = JSON.parse(redisUser);
  } else {
    user = await User.findOne({ email: email });
    if (!user) {
      res.status(400).json({ success: false, message: "user not found" });
      return;
    }
  }

  if (user.verificationCode !== code) {
    res
      .status(400)
      .json({ success: false, message: "password is not matched" });
    return;
  }

  res
    .status(200)
    .json({ success: false, message: "password matched successfully" });
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
      message: "Email, token, and new password are required.",
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

    await User.findOneAndUpdate(
      { email },
      {
        $set: { password: hashedPassword },
      },
      { new: true }
    );
    user.password = hashedPassword;
    await redisClient.set(`user:${email}`, JSON.stringify(user), {
      EX: 86400,
    });

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

/**
 * @route   PUT /api/user/profile
 * @desc    Update user profile with optional PDF upload (e.g., driving licence)
 * @access  Private (Requires authentication)
 */

export async function userProfile(req: Request, res: Response): Promise<void> {
  interface CloudinaryFile extends Express.Multer.File {
    url?: string;
    secure_url?: string;
  }

  const userId = req.user?.userId;
  const { firstName, lastName, gender, age } = req.body;
  const pdf = req.file as CloudinaryFile;

  try {
    const updatedData: any = {
      firstName,
      lastName,
      gender,
      age,
    };

    // Attach PDF data if uploaded
    if (pdf) {
      updatedData.drivingLicence = {
        url: pdf.path,
        public_id: pdf.secure_url,
      };
    }

    const userProfile = await User.findByIdAndUpdate(userId, updatedData, {
      new: true,
    });

    if (!userProfile) {
      res.status(400).json({
        success: false,
        message: "Failed to update user profile. User not found.",
      });
      return;
    }

    // Cache updated profile in Redis for 1 day (86400 seconds)
    await redisClient.setEx(
      `user:${userProfile.email}`,
      86400,
      JSON.stringify(userProfile)
    );

    res.status(200).json({
      success: true,
      message: "User profile updated successfully.",
      data: userProfile,
    });
  } catch (error) {
    console.error("Profile Update Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating profile.",
    });
  }
}




// Controller: Change user password after verifying old one
export async function changeUserPassword(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user?.userId;
  const { oldPassword, newPassword, reNewPassword } = req.body;

  if (!userId) {
    res.status(401).json({ success: false, message: "Unauthorized user." });
    return;
  }

  if (!oldPassword || !newPassword || !reNewPassword) {
    res.status(400).json({
      success: false,
      message: "Please provide all required fields.",
    });
    return;
  }

  if (newPassword !== reNewPassword) {
    res.status(400).json({
      success: false,
      message: "New password and confirmation do not match.",
    });
    return;
  }

  try {
    const user = await User.findById(userId);
    if (!user || !user.password) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      res.status(400).json({
        success: false,
        message: "Old password is incorrect.",
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    await user.save();

    // Optional: update Redis cache if you're caching user
    await redisClient.setEx(`user:${user.email}`, 86400, JSON.stringify(user));

    res.status(200).json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
}




