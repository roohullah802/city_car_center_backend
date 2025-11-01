import { ObjectId } from "mongoose";

export interface JwtPayload {
  name: string;
  email: string;
  drivingLicence: string;
  profile: string;
  role: string;
  isAdminExist: boolean;
  clerkId: string;
  _id: string;
  }

  declare global {
    namespace Express {
      interface Request {
        user?: {
          _id: string,
          email: string
        };
      }
    }
  }
  