import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export interface UserDocument extends Document {
  firstName: string;
  lastName: string;
  email: string;
  gender: string;
  age: number;
  drivingLicence: string;
  phoneNo: string;
  password: string;
  profile: string;
  isVerified: boolean;
  verificationCode: number | undefined;
  createdAt: Date;
  updatedAt: Date;
}

const userPDFSchema = new mongoose.Schema(
  {
    url: { type: String },
    public_id: { type: String },
  },
  { _id: false }
);

const userSchema = new Schema<UserDocument>(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
    },
    gender: {
      type: String,
      enum: ["Male", "Female"]
    },
    age: {
      type: Number,
    },
    drivingLicence: {type:String},
    phoneNo: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    profile:{
      type: String
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationCode: {
      type: Number,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre<UserDocument>("save", async function (next): Promise<void> {
  if (!this.isModified("password")) return next();

  const hashedPassword = await bcrypt.hash(this.password, 10);
  this.password = hashedPassword;
  next();
});

export const User = mongoose.model<UserDocument>("User", userSchema);
