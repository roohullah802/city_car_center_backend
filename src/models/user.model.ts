import { kStringMaxLength } from "buffer";
import mongoose, { Document, Schema } from "mongoose";

export interface UserDocument extends Document {
 name: string;
  email: string;
  drivingLicence: string;
  cnicFront: string;
  cnicBack: string;
  extraDocuments: [];
  documentStatus: string;
  profile: string;
  role: string;
  isAdminExist: boolean;
  clerkId: string;
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
    documentStatus: {
      type: String,
      enum: ['notVerified', 'verified', 'rejected'],
      default: 'notVerified'
    },
    cnicFront: {
      type: String
    },
    cnicBack: {
      type: String
    },
    extraDocuments:{
      type: [String],
      default: []
    }
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<UserDocument>("User", userSchema);
