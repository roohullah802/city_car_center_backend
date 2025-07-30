import mongoose, {Document} from "mongoose";

interface PolicyDocument extends Document {
  title: string,
  content: string
}
const policySchema = new mongoose.Schema<PolicyDocument>({
  title: { type: String, required: true },
  content: { type: String, required: true },
}, { timestamps: true });

const Policy = mongoose.model<PolicyDocument>("Policy", policySchema);
export {Policy};
