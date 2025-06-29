import { Request, Response } from 'express'
import { createCarSchema } from '../../lib/zod/zod.car.listing'
import { Car } from '../../models/car.model';



export async function carListing(req: Request, res: Response): Promise<void> {
    const parsed = createCarSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: parsed.error.flatten().fieldErrors,
        });
        return;
    }

    const {
        brand,
        modelName,
        year,
        color,
        price,
        passengers,
        doors,
        airCondition,
        maxPower,
        mph,
        topSpeed,
        available,
        tax,
        weeklyRate,
        pricePerDay,
        initialMileage,
        allowedMilleage,
        brandImage,
        fuelType,
        transmission,
        description,
        images
    } = parsed.data

    const car = await Car.create({
        brand,
        modelName,
        year,
        color,
        price,
        passengers,
        doors,
        airCondition,
        maxPower,
        mph,
        topSpeed,
        available,
        tax,
        weeklyRate,
        pricePerDay,
        initialMileage,
        allowedMilleage,
        brandImage,
        fuelType,
        transmission,
        description,
        images
    })

    if (!car) {
        res.status(400).json({ success: false, message: "car not registered" })
        return;
    }

    res.status(200).json({ success: true, message: "car registered successfully", car })





}

