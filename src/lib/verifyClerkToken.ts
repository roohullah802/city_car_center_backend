import dotenv from 'dotenv'
dotenv.config()
import { NextFunction, Request, Response } from "express";
import { createClerkClient, verifyToken } from "@clerk/backend";

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

    // ✅ Verify token signature & claims
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    if (!payload?.sub) {
      res.status(401).json({ success: false, message: "Invalid token payload" });
      return;
    }

    // ✅ Optionally fetch the full user (optional optimization)
    const user = await clerkClient.users.getUser(payload.sub);

    // Attach user to request for later use
    (req as any).user = user;
    (req as any).auth = { userId: user.id };

    return next();
  } catch (error: any) {
    console.error("❌ Clerk token verification failed:", {
      message: error.message,
      stack: error.stack,
    });

    res.status(401).json({
      success: false,
      message: "Unauthorized: invalid or expired token",
    });
  }
};
