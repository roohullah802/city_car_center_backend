import { z } from "zod";

export const createCarSchema = z.object({
  brand: z.string(),
  modelName: z.string(),
  year: z.coerce.number(),
  color: z.string(),
  price: z.coerce.number(),
  passengers: z.coerce.number(),
  doors: z.coerce.number(),
  airCondition: z.coerce.boolean(),
  maxPower: z.coerce.number(),
  mph: z.coerce.number(),
  topSpeed: z.coerce.number(),
  available: z.coerce.boolean(),
  tax: z.coerce.number(),
  weeklyRate: z.coerce.number(),
  pricePerDay: z.coerce.number(),
  initialMileage: z.coerce.number(),
  allowedMilleage: z.coerce.number(),
  fuelType: z.string(),
  transmission: z.string(),
  description: z.string(),
});

