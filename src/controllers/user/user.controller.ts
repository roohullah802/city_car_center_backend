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
    const userId = req.user?.userId;



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
    const userId = req.user?.userId


    if (!userId) {
        res.status(401).json({
            success: false,
            message: 'Unauthorized. Please log in to create a lease.',
        });
        return;
    }

    type DateType = {
        startDate: string,
        endDate: string
    }

    const { startDate, endDate } = req.body as DateType;
    const carId = req.params?.id as string

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
        console.log(totalAmount);


        const lease = await Lease.create({
            user: new mongoose.Types.ObjectId(userId),
            car: new mongoose.Types.ObjectId(carId),
            startDate: start,
            endDate: end,
            totalAmount,
            returnedDate: end,
            status: 'pending',
        });

        // Optionally mark car unavailable
        await Car.updateOne({ "_id": carId }, { "available": false })

        const stripe = new Stripe(process.env.STRIPE_SERVER_KEY! as string, {
            apiVersion: '2025-05-28.basil',
        });

        const intent = await stripe.paymentIntents.create({
            amount: Math.round(totalAmount * 100),
            currency: "usd",
            payment_method_types: ['card'],
            metadata: {
                carId: carId,
                userId: userId,
                leaseId: String(lease._id)
            }
        });

        lease.paymentId = intent.id
        await lease.save()

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







/**
 * @route   POST /api/lease/extend
 * @desc    Extend a lease by additional days and initiate payment
 * @access  Private
 */
export async function extendLease(req: Request, res: Response): Promise<void> {
    type Days = { additionalDays: number }
    const { additionalDays } = req.body as Days;
    const leaseId = req.params.id as string;
    const userId = req.user?.userId as string;

    // ✅ Validate inputs
    if (!leaseId || !additionalDays || additionalDays <= 0) {
        res.status(400).json({
            success: false,
            message: 'Valid leaseId and additionalDays are required.',
        });
        return;
    }

    try {
        // ✅ Fetch lease
        const lease = await Lease.findById(leaseId).populate('car');

        if (!lease) {
            res.status(404).json({
                success: false,
                message: 'Lease not found.',
            });
            return;
        }

        // ✅ Ensure user owns the lease
        if (lease.user.toString() !== userId) {
            res.status(403).json({
                success: false,
                message: 'Unauthorized to modify this lease.',
            });
            return;
        }

        const car = lease.car as any;


        const oldEndDate = new Date(lease.endDate);
        const newEndDate = new Date(oldEndDate);
        newEndDate.setDate(newEndDate.getDate() + additionalDays);

        // ✅ Check if lease has exactly 1 day left
        const now = new Date();
        const oneDayInMs = 24 * 60 * 60 * 1000;
        const timeLeft = new Date(lease.endDate).getTime() - now.getTime();

        if (timeLeft > oneDayInMs || timeLeft < 0) {
            res.status(400).json({
                success: false,
                message: 'Lease can only be extended when 1 day is remaining.',
            });
            return;
        }



        const dailyRate = car.pricePerDay;
        const totalAmount = dailyRate * additionalDays * 100; // Stripe expects cents

        console.log(totalAmount);

        const stripe = new Stripe(process.env.STRIPE_SERVER_KEY! as string, {
            apiVersion: '2025-05-28.basil',
        });

        const paymentIntent = await stripe.paymentIntents.create({
            amount: totalAmount,
            currency: 'usd',
            metadata: {
                leaseId: lease._id.toString(),
                carId: car._id.toString(),
                type: 'lease_extension',
                userId,
            },
        });

        // ✅ Update lease (optional pre-update)
        lease.endDate = newEndDate;
        lease.status = 'pending'; // Wait until payment confirmation
        lease.returnedDate = newEndDate
        await Lease.updateOne({paymentId: lease.paymentId}, {paymentId: paymentIntent.id})
        await lease.save();

        res.status(200).json({
            success: true,
            message: `Lease extended by ${additionalDays} day(s). Payment required.`,
            lease: {
                id: lease._id,
                car: car._id,
                oldEndDate,
                newEndDate,
                dailyRate,
                additionalDays,
                totalAmount: totalAmount / 100,
                status: lease.status,
            },
            paymentIntentClientSecret: paymentIntent.client_secret,
        });

    } catch (err) {
        console.error('❌ Error during lease extension:', err);
        res.status(500).json({
            success: false,
            message: 'Server error while extending lease.',
        });
    }
}








/**
 * @route   GET /api/payment/history
 * @desc    Get logged-in user's lease payment history
 * @access  Private
 */
export async function getPaymentDetails(req: Request, res: Response): Promise<void> {
    const userId = req.user?.userId;

    if (!userId) {
        res.status(401).json({
            success: false,
            message: 'Unauthorized: user ID missing',
        });
        return;
    }

    try {

        const leases = await Lease.find({ user: userId }).populate('car');

        if (!leases.length) {
            res.status(200).json({
                success: true,
                message: 'No lease history found.',
                data: {
                    totalLeases: 0,
                    totalPending: 0,
                    totalPaid: 0,
                    totalCancelled: 0,
                    totalAmountPaid: 0,
                    leases: [],
                },
            });
            return;
        }


        const totalPaid = leases.filter(l => l.status === 'completed').length;
        const totalCancelled = leases.filter(l => l.status === 'cancel').length;
        const totalPending = leases.filter(l => l.status === 'pending').length;
        const totalAmountPaid = leases
            .filter(l => l.status === 'completed')
            .reduce((sum, l) => sum + (l.totalAmount || 0), 0);

        res.status(200).json({
            success: true,
            message: 'Lease payment history fetched successfully.',
            data: {
                totalLeases: leases.length,
                totalPaid,
                totalPending,
                totalCancelled,
                totalAmountPaid,
                leases: leases,
            },
        });

    } catch (err) {
        console.error('❌ Error fetching payment details:', err);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching payment history.',
        });
    }
}






/**
 * @route   POST /lease/:id/return
 * @desc    Allows a user to return a leased car
 * @access  Protected (requires authentication)
 */
export async function returnCar(req: Request, res: Response): Promise<void> {
  const leaseId = req.params.id;
  const userId = req.user?.userId;

  if (!leaseId || !userId) {
    res.status(400).json({ success: false, message: 'Lease ID and user authentication required.' });
    return;
  }

  try {
    const lease = await Lease.findById(leaseId);

    if (!lease) {
      res.status(404).json({ success: false, message: 'Lease not found.' });
      return;
    }

    if (lease.user.toString() !== userId) {
      res.status(403).json({ success: false, message: 'You are not authorized to return this car.' });
      return;
    }

    if (lease.isReturned) {
      res.status(400).json({ success: false, message: 'Car already returned.' });
      return;
    }

    lease.isReturned = true;
    lease.status = 'returned';
    lease.returnedDate = new Date();

    await lease.save();

    res.status(200).json({
      success: true,
      message: 'Car successfully returned.',
      lease: {
        id: lease._id,
        returnedAt: lease.returnedDate,
        status: lease.status,
      },
    });
  } catch (error) {
    console.error('❌ Error returning car:', error);
    res.status(500).json({ success: false, message: 'Server error while returning car.' });
  }
}
