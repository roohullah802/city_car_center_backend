import { Document } from 'mongoose'

export interface CarDocument extends Document {
    brand: string;
    modelName: string;
    year: number;
    color: string;
    price: number;
    passengers: number,
    doors: number,
    airCondition: boolean,
    maxPower: number,
    mph: number,
    topSpeed: number,
    available: boolean,
    tax: number,
    weeklyRate: number,
    pricePerDay: number,
    initialMileage: number;
    allowedMilleage: number;
    brandImage: string;
    fuelType: 'petrol' | 'diesel' | 'electric' | 'hybrid';
    transmission: 'manual' | 'automatic';
    description?: string;
    images: string[];
    createdAt: Date;
    updatedAt: Date;
}