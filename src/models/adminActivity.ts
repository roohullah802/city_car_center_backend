import mongoose, { Schema, Document } from "mongoose";

export interface IAdminActivity extends Document {
  action: string;       // e.g., "createLease", "extendLease"
  user: mongoose.Types.ObjectId;
  lease?: mongoose.Types.ObjectId;
  car?: mongoose.Types.ObjectId;
  description: string;  // human-readable message
  createdAt: Date;
}

const AdminActivitySchema = new Schema<IAdminActivity>(
  {
    action: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lease: { type: Schema.Types.ObjectId, ref: "Lease" },
    car: { type: Schema.Types.ObjectId, ref: "Car" },
    description: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const AdminActivity = mongoose.model<IAdminActivity>(
  "AdminActivity",
  AdminActivitySchema
);
