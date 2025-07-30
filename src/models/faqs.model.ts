import mongoose, {Document} from 'mongoose';

interface FaqDocument extends Document {
  question: string,
  answer: string
}
const faqSchema = new mongoose.Schema<FaqDocument>({
  question: { type: String, required: true },
  answer: { type: String, required: true },
}, { timestamps: true });

const Faq =  mongoose.model<FaqDocument>('Faq', faqSchema);
export {Faq};
