import { z } from "zod";

export const createCarSchema = z.object({
  brand: z.string({ required_error: "Brand is required" }),
  modelName: z.string({ required_error: "Model name is required" }),
  year: z.number({ required_error: "Year is required" }),
  color: z.string({ required_error: "Color is required" }),
  price: z.number({ required_error: "Price is required" }),
  passengers: z.number({ required_error: "Passengers count is required" }),
  doors: z.number({ required_error: "Number of doors is required" }),
  airCondition: z.boolean({ required_error: "Air condition info is required" }),
  maxPower: z.number({ required_error: "Max power is required" }),
  mph: z.number({ required_error: "MPH is required" }),
  topSpeed: z.number({ required_error: "Top speed is required" }),
  available: z.boolean({ required_error: "Availability is required" }),
  tax: z.number({ required_error: "Tax is required" }),
  weeklyRate: z.number({ required_error: "Weekly rate is required" }),
  pricePerDay: z.number({ required_error: "Price per day is required" }),
  initialMileage: z.number({ required_error: "Initial mileage is required" }),
  allowedMilleage: z.number({ required_error: "Allowed mileage is required" }),
  brandImage: z.array(z.string().url({ message: "Each brand image must be a valid URL" })).nonempty({ message: "At least one brand image is required" }),
  fuelType: z.enum(["Petrol", "Diesel", "Electric", "Hybrid"], {
    required_error: "Fuel type is required",
    invalid_type_error: "Fuel type must be one of: petrol, diesel, electric, hybrid"
  }),
  transmission: z.enum(["manual", "Automatic"], {
    required_error: "Transmission type is required",
    invalid_type_error: "Transmission must be one of: manual, automatic"
  }),
  description: z.string().optional(),
  images: z.array(z.string().url({ message: "Each image must be a valid URL" })).nonempty({ message: "At least one image is required" })
});
