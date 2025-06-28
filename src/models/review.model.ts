import { Schema, model, Document, Types } from 'mongoose';
import { ReviewDocument } from '../types/review.types'


const reviewSchema = new Schema<ReviewDocument>(
    {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        car: { type: Schema.Types.ObjectId, ref: 'Car', required: true },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        comment: {
            type: String,
            trim: true,
        },
    },
    { timestamps: true }
);

export const Review = model<ReviewDocument>('Review', reviewSchema);
