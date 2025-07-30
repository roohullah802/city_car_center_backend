import mongoose, {Document} from "mongoose";
interface reportDocuments extends Document {
  userId: mongoose.Types.ObjectId
  description: string,
  email: string,
  status: string
}


const issueReportSchema = new mongoose.Schema<reportDocuments>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  description: { type: String, required: true },
  email: { type: String, required: true },
  status: { type: String, default: "pending" },
}, {timestamps: true});

export const IssueReport = mongoose.model<reportDocuments>("IssueReport", issueReportSchema);
