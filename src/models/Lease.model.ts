import { Schema, model } from "mongoose";
import { LeaseDocument } from "../types/lease.types";

const leaseSchema = new Schema<LeaseDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    car: { type: Schema.Types.ObjectId, ref: "Car", required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalAmount: { type: Number, required: true },
    isReturned: { type: Boolean, default: false },
    lastReminderSentAt: { type: Date },
    returnedDate: { type: Date },
    paymentId: [{ type: String }],
    status: {
      type: String,
      enum: ["pending", "completed", "cancel"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export const Lease = model<LeaseDocument>("Lease", leaseSchema);
