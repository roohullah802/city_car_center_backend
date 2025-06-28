import mongoose from "mongoose";

export interface ReviewDocument extends Document {
    user: mongoose.Types.ObjectId;     // Reference to User
    car: mongoose.Types.ObjectId;      // Reference to Car
    rating: number;           // e.g. 1 to 5
    comment?: string;
    createdAt: Date;
    updatedAt: Date;
  }