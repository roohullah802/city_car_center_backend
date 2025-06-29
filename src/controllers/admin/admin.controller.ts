import { Request, Response } from 'express'
import { createCarSchema } from '../../lib/zod/zod.car.listing'
import { Car } from '../../models/car.model';
import { Lease } from '../../models/Lease.model';
import { v2 as cloudinary } from 'cloudinary';





interface CloudinaryFile extends Omit<Express.Multer.File, 'path'> {
    path?: string;
    secure_url?: string;
    filename: string
}

type MulterFiles = {
    images?: CloudinaryFile[];
    brandImage?: CloudinaryFile[];
};

export async function carListing(req: Request, res: Response): Promise<void> {
    const parsed = createCarSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: parsed.error.flatten().fieldErrors,
        });
        return
    }

    const files = req.files as MulterFiles;
    const imageUrls = (files.images || []).map(file => ({
        url: file.secure_url || file.path || '',
        public_id: file.filename || '',
    }));

    const brandImageFile = files.brandImage?.[0];

    const brandImage = {
        url: brandImageFile?.secure_url || brandImageFile?.path || '',
        public_id: brandImageFile?.filename || '',
    };


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
        fuelType,
        transmission,
        description,
    } = parsed.data;

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
        fuelType,
        transmission,
        description,
        brandImage: brandImage,
        images: imageUrls,
    });


    res.status(200).json({
        success: true,
        message: 'Car registered successfully',
        car: JSON.parse(JSON.stringify(car)),
    });
}








/**
 * Deletes a lease by its ID, updates the associated car to be available again.
 */
export async function deleteLease(req: Request, res: Response): Promise<void> {
    const leaseId = req.params?.id as string;


    if (!leaseId) {
        res.status(400).json({ success: false, message: "Lease ID is required." });
        return;
    }


    const lease = await Lease.findById(leaseId);

    if (!lease) {
        res.status(404).json({ success: false, message: "Lease not found." });
        return;
    }


    await Car.findByIdAndUpdate(lease.car, { available: true });


    await Lease.findByIdAndDelete(leaseId);


    res.status(200).json({ success: true, message: "Lease successfully deleted. Car is now available." });
}






export async function deleteCarListing(req: Request, res: Response): Promise<void> {
  try {
    const carId = req.params.id;
    if (!carId) {
        res.status(404).json({ success: false, message: 'CarId not found' });
      return;
    }

    const car = await Car.findById(carId);
    if (!car) {
      res.status(404).json({ success: false, message: 'Car not found' });
      return;
    }

    // ✅ Delete images from Cloudinary
    for (const image of car?.images || []) {
      if (image.public_id) {
        await cloudinary.uploader.destroy(image.public_id);
      }
    }

    // ✅ Delete brand image
    if (car.brandImage?.public_id) {
      await cloudinary.uploader.destroy(car.brandImage.public_id);
    }

    // ✅ Delete the car from the DB
    await Car.findByIdAndDelete(carId);

    res.status(200).json({ success: true, message: 'Car and images deleted successfully' });
  } catch (error) {
    console.error('Error deleting car:', error);
    res.status(500).json({ success: false, message: 'Server error', error });
  }
}
