import mongoose from "mongoose";


export interface LeaseDocument extends Document {
    user: mongoose.Types.ObjectId;
    car: mongoose.Types.ObjectId;
    startDate: Date;
    endDate: Date;
    totalAmount: number;
    status: string;
    isReturned: boolean;
    returnedDate: Date;
    createdAt: Date;
    updatedAt: Date;
  }