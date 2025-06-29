import mongoose, { Schema, Document } from 'mongoose';
import {CarDocument} from '../types/car.types'


const carSchema = new Schema<CarDocument>(
  {
    brand: { type: String, required: true },
    modelName: { type: String, required: true },
    year: { type: Number, required: true },
    color: { type: String, required: true },
    price: { type: Number, required: true },
    passengers: { type: Number, required: true },
    doors: { type: Number, required: true },
    airCondition: { type: Boolean, required: true },
    maxPower: { type: Number, required: true },
    mph: { type: Number, required: true },
    topSpeed: { type: Number, required: true },
    available: { type: Boolean, required: true },
    tax: { type: Number, required: true },
    weeklyRate: { type: Number, required: true },
    pricePerDay: { type: Number, required: true },
    initialMileage: { type: Number, required: true },
    allowedMilleage: { type: Number, required: true },
    brandImage: [{type: String}],
    fuelType: {
      type: String,
      enum: ['Petrol', 'Diesel', 'Electric', 'Hybrid'],
      required: true,
    },
    transmission: {
      type: String,
      enum: ['Manual', 'Automatic'],
      required: true,
    },
    description: { type: String },
    images: [{ type: String }],
  },
  { timestamps: true }
);

export const Car = mongoose.model<CarDocument>('Car', carSchema);
