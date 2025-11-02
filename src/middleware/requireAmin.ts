import { Request, Response, NextFunction } from "express";
import { User } from "../models/user.model";

export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const reqUser = (req as any).user;

  if (!reqUser) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const user = await User.findById(reqUser._id);

    if (!user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    if (user.role !== "admin" || user.status !== "approved") {
      res
        .status(403)
        .json({ message: "Access denied. Waiting for admin approval." });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
