import dotenv from 'dotenv';
dotenv.config();
import { NextFunction, Request, Response } from "express";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { User } from '../models/user.model';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

export const verifyClerkToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Missing or invalid Authorization header",
      });
      return;
    }

    const token = authHeader.split(" ")[1].trim();

 
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    if (!payload?.sub) {
      res.status(401).json({ success: false, message: "Invalid token payload" });
      return;
    }

 
    const clerkUser = await clerkClient.users.getUser(payload.sub);
    const email = clerkUser.emailAddresses[0].emailAddress;


    const dbUser = await User.findOne({ email });

    if (!dbUser) {
      res.status(404).json({
        success: false,
        message: "User not found in database",
      });
      return;
    }

    (req as any).user = {
      _id: dbUser._id,
      email: email,
    };

    (req as any).auth = { userId: dbUser._id };

    next();
  } catch (error: any) {
    console.error("Clerk token verification failed:", {
      message: error.message,
      stack: error.stack,
    });

    res.status(401).json({
      success: false,
      message: "Unauthorized: invalid or expired token",
    });
  }
};
