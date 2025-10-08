import mongoose, {Document} from "mongoose";
interface reportDocuments extends Document {
  user: mongoose.Types.ObjectId
  description: string,
  email: string,
}


const issueReportSchema = new mongoose.Schema<reportDocuments>({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  description: { type: String, required: true },
  email: { type: String, required: true },
}, {timestamps: true});

export const IssueReport = mongoose.model<reportDocuments>("IssueReport", issueReportSchema);
