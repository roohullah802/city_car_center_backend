import { z } from "zod";

export const createUpdateCarSchema = z.object({
  brand: z.string().optional(),
  modelName: z.string().optional(),
  year: z.coerce.number().optional(),
  color: z.string().optional(),
  price: z.coerce.number().optional(),
  passengers: z.coerce.number().optional(),
  doors: z.coerce.number().optional(),
  airCondition: z.coerce.boolean().optional(),
  maxPower: z.coerce.number().optional(),
  mph: z.coerce.number().optional(),
  topSpeed: z.coerce.number().optional(),
  available: z.coerce.boolean().optional(),
  tax: z.coerce.number().optional(),
  weeklyRate: z.coerce.number().optional(),
  pricePerDay: z.coerce.number().optional(),
  initialMileage: z.coerce.number().optional(),
  allowedMilleage: z.coerce.number().optional(),
  fuelType: z.string().optional(),
  transmission: z.string().optional(),
  description: z.string().optional(),
});
