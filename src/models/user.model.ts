import mongoose, { Document, Schema } from "mongoose";

export interface UserDocument extends Document {
 name: string;
  email: string;
  drivingLicence: string;
  profile: string;
  role: string;
  isAdminExist: boolean;
  clerkId: string;
  status: string;
  source: string;
}


const userSchema = new Schema<UserDocument>(
  {
   clerkId: { type: String, unique: true },
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
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['pending', 'approved'],
      default: 'pending'
    },
    source: {
      type: String,
      enum: ['admin', 'mobile'],
      default: 'mobile'
    }
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<UserDocument>("User", userSchema);
