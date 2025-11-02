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

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
        success: false,
        message: "Missing or invalid Authorization header",
      });
      return
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // ✅ Verify token properly
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    if (!payload?.sub) {
      res.status(401).json({ success: false, message: "Invalid token" });
      return
    }

    // ✅ Optionally fetch the full user
    const user = await clerkClient.users.getUser(payload.sub);

    (req as any).user = user;
    (req as any).auth = { userId: user.id };

    next();
  } catch (error: any) {
    console.error("❌ Clerk token verification failed:", error.message);
    res.status(401).json({ success: false, message: "Unauthorized" });
    return
  }
};
