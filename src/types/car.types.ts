import mongoose from "mongoose";

  
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
    images: string; // ✅ Correct type
    brandImage: string;
    createdAt: Date;
    updatedAt: Date;
  }
  