import { Request, Response, NextFunction, RequestHandler } from "express";
import { User, UserDocument } from "../models/user.model";


export const asyncHandler = (fn: RequestHandler) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };


const attachUserFn: RequestHandler = async (req, res, next) => {
  const clerkId = req.auth?.userId;

  if (!clerkId) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const user = await User.findOne({ clerkId });
  if (!user) {
    res.status(404).json({ message: "User not found in DB" });
    return;
  }

  req.user = {
    _id: user._id!.toString(),
    email: user.email
  }
  next();
};

export const attachUser = asyncHandler(attachUserFn);

