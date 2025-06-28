import { Request, Response } from 'express'
import { Car } from '../../models/car.model'
import mongoose from 'mongoose';
import { Lease } from '../../models/Lease.model';
import Stripe from 'stripe';



/**
 * @route   POST /api/cars/details
 * @desc    Get details of a single car, including its reviews
 * @access  Public or Protected (depending on your setup)
 */
export async function getCarDetails(req: Request, res: Response): Promise<void> {
    type CarId = {
        id: string;
    };

    const { id } = req.params as CarId;

    if (!id) {
        res.status(400).json({
            success: false,
            message: 'Please provide a valid carId to fetch car details.',
        });
        return;
    }

    try {
        const cars = await Car.aggregate([
            {
                $match: { _id: new mongoose.Types.ObjectId(id) },
            },
            {
                $lookup: {
                    from: 'reviews',
                    localField: '_id',
                    foreignField: 'car',
                    as: 'car_reviews',
                },
            },
            {
                $addFields: {
                    totalReviews: { $size: '$car_reviews' },
                    averageRating: { $avg: '$car_reviews.rating' },
                },
            },
        ]);

        if (!cars || cars.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Car not found with the provided ID.',
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Car details fetched successfully.',
            data: cars[0],
        });
    } catch (error) {
        console.error('Error fetching car details:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching car details.',
        });
    }
}






/**
 * @route   GET /api/cars
 * @desc    Fetch all available cars
 * @access  Protected (requires authenticated user)
 */
export async function getAllCars(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
        res.status(401).json({
            success: false,
            message: 'Unauthorized access. Please log in to view available cars.',
        });
        return;
    }

    try {
        const allCars = await Car.aggregate([
            {
                $match: {}
            },
            {
                $lookup: {
                    from: "reviews",
                    localField: "_id",
                    foreignField: "car",
                    as: "reviews_data"
                }
            },
            {
                $addFields: {
                    totalReviews: { $size: "$reviews_data" }
                }
            },
            {
                $unwind: "$reviews_data"
            }
        ])

        if (!allCars || allCars.length === 0) {
            res.status(404).json({
                success: false,
                message: 'No cars found in the system.',
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Cars fetched successfully.',
            data: allCars,
        });
    } catch (error) {
        console.error('Error fetching cars:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching cars.',
        });
    }
}







/**
 * @route   POST /api/lease
 * @desc    Create a new lease agreement for a car
 * @access  Protected (requires authenticated user)
 */
export async function createLease(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized. Please log in to create a lease.',
    });
    return;
  }

  const { carId, startDate, endDate } = req.body;

  if (!carId || !startDate || !endDate) {
    res.status(400).json({
      success: false,
      message: 'carId, startDate, and endDate are required.',
    });
    return;
  }

  try {
    const car = await Car.findById(carId);

    if (!car) {
      res.status(404).json({
        success: false,
        message: 'Car not found.',
      });
      return;
    }

    if (!car.available) {
      res.status(400).json({
        success: false,
        message: 'This car is currently not available for lease.',
      });
      return;
    }

    // Enforce 7-day lease only
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dayDifference = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    if (dayDifference !== 7) {
      res.status(400).json({
        success: false,
        message: 'The first lease must be exactly 7 days long.',
      });
      return;
    }

    const totalAmount = car.pricePerDay * 7;

    const lease = await Lease.create({
      user: new mongoose.Schema.Types.ObjectId(userId),
      car: new mongoose.Schema.Types.ObjectId(carId),
      startDate: start,
      endDate: end,
      totalAmount,
      status: 'pending',
    });

    // Optionally mark car unavailable
    car.available = false;
    await car.save();

    const stripe = new Stripe(process.env.STRIPE_SERVER_KEY! as string, {
        apiVersion: '2025-05-28.basil',
      });

      const intent = await stripe.paymentIntents.create({
        amount: Math.round(totalAmount * 100),
        currency: "usd",
        payment_method_types: ['card'],
        metadata:{
            carId: carId,
            userId: userId,
            leaseId: String(lease._id)
        }
      });

    res.status(201).json({
      success: true,
      message: 'Lease created successfully for 7 days.',
      data: lease,
      client_secret: intent.client_secret
    });
  } catch (error) {
    console.error('Lease creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while creating lease.',
    });
  }
}



