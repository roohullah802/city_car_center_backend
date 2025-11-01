import { ObjectId } from "mongoose";
import { IUser, UserDocument } from "../models/user.model";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;     
        sessionId?: string;
        getToken?: () => Promise<string>;
      };
      user?: {
        _id: string,
        email: string
      };          
    }
  }
}
