import mongoose from "mongoose";

export interface ImageObject {
    url: string;
    public_id: string;
  }

  
  export interface CarDocument extends mongoose.Document {
    brand: string;
    modelName: string;
    year: number;
    color: string;
    price: number;
    passengers: number;
    doors: number;
    airCondition: boolean;
    maxPower: number;
    mph: number;
    topSpeed: number;
    available: boolean;
    tax: number;
    weeklyRate: number;
    pricePerDay: number;
    initialMileage: number;
    allowedMilleage: number;
    fuelType: string;
    transmission: string;
    description: string;
    images: ImageObject[]; // ✅ Correct type
    brandImage: ImageObject;
    createdAt: Date;
    updatedAt: Date;
  }
  