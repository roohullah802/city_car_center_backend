import mongoose from "mongoose";


export interface LeaseDocument extends Document {
    user: mongoose.Types.ObjectId;
    car: mongoose.Types.ObjectId;
    startDate: Date;
    endDate: Date;
    totalAmount: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }