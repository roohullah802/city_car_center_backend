// src/cron/leaseReminder.ts

import cron from 'node-cron';
import { Lease } from '../../models/Lease.model';
import { sendNotifyEmail } from '../mail/node.cron.mailer';


cron.schedule('0 * * * *', async () => {

    const now = new Date();
    const oneDayMs = 24 * 60 * 60 * 1000;

    const leases = await Lease.find({
        isReturned: false,
        endDate: { $gt: now }
    }).populate('car');

    for (const lease of leases) {
        const timeLeft = new Date(lease.endDate).getTime() - now.getTime();

        if (timeLeft <= oneDayMs) {
            const last = new Date(0);
            const hoursSinceLast = (now.getTime() - last.getTime()) / (1000 * 60 * 60);

            if (hoursSinceLast >= 2) {
                const user = lease.user as any;
                const car = lease.car as any;
                await sendNotifyEmail(user.email, car.modelName, lease._id, timeLeft)
            }
        }
    }
});
