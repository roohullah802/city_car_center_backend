import mongoose, { Document, Schema } from "mongoose";

export interface UserDocument extends Document {
 name: string;
  email: string;
  drivingLicence: string;
  profile: string;
  role: string;
  provider: string;
  providerId: string;
  password: string;
  isAdminExist: boolean;
}


const userSchema = new Schema<UserDocument>(
  {
   name: {
    type: String,
    required: true
   },
    email: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
    },
    drivingLicence: {type:String},
    profile:{
      type: String,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    },
    isAdminExist: {
      type: Boolean
    },
    password: {
      type: String
    },
    provider:{
      type: String,
    },
    providerId: {
      type: String,
    }
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<UserDocument>("User", userSchema);
