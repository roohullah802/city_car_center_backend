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
    lastReminderSentAt: Date;
    paymentId: string;
    createdAt: Date;
    updatedAt: Date;
  }