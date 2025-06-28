import { Request, Response } from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { Car } from '../models/car.model';
import { Lease } from '../models/Lease.model';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SERVER_KEY! as string, {
    apiVersion: '2025-05-28.basil',
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

/**
 * Stripe Webhook Handler
 * Listens for Stripe events (e.g., payment_intent.succeeded)
 */
export async function webhookHandler(req: Request, res: Response): Promise<void> {
    const sig = req.headers['stripe-signature'] as string;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error('Webhook signature verification failed.', err);
        res.status(400).send(`Webhook Error: ${(err as Error).message}`);
        return;
    }

    // Handle event types
    switch (event.type) {
        case 'payment_intent.succeeded':
            const intent = event.data.object as Stripe.PaymentIntent;
            await Car.findByIdAndUpdate(intent.metadata?.carId, {
                available: false
            }, { new: true })
            await Lease.findByIdAndUpdate(intent.metadata?.leaseId, {
                status: "completed"
            }, { new: true })
            break;

        case 'payment_intent.payment_failed':
            const failedIntent = event.data.object as Stripe.PaymentIntent;
            await Car.findByIdAndUpdate(failedIntent.metadata?.carId, {
                available: true
            }, { new: true })
            await Lease.findByIdAndUpdate(failedIntent.metadata?.leaseId, {
                status: "cancel"
            }, { new: true })
            break;
        case 'payment_intent.canceled':
            const cancelIntent = event.data.object as Stripe.PaymentIntent;
            await Car.findByIdAndUpdate(cancelIntent.metadata?.carId, {
                available: true
            }, { new: true })
            await Lease.findByIdAndUpdate(cancelIntent.metadata?.leaseId, {
                status: "cancel"
            }, { new: true })
            break;
        case 'payment_intent.created':
            const createdIntent = event.data.object as Stripe.PaymentIntent;
            await Lease.findByIdAndUpdate(createdIntent.metadata?.leaseId, {
                status: "pending"
            }, { new: true })
            break;

        default:
            console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).send('Received');
}
