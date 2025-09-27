// src/cron/leaseReminder.ts

import cron from "node-cron";
import { Lease } from "../../models/Lease.model";
import { sendNotifyEmail } from "../mail/node.cron.mailer";
import { Car } from "../../models/car.model";
import { redisClient } from "../redis/redis";

export function startCronJob() {
    cron.schedule("0 * * * *", async () => {
  const now = new Date();
  const oneDayMs = 24 * 60 * 60 * 1000;

  const leases = await Lease.find({
    isReturned: false,
    endDate: { $gt: now },
  }).populate("car");

  for (const lease of leases) {
    const timeLeft = new Date(lease.endDate).getTime() - now.getTime();

    if (timeLeft <= oneDayMs) {
      const last = lease.lastReminderSentAt || new Date(0);
      const hoursSinceLast =
        (now.getTime() - last.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLast >= 2) {
        const user = lease.user as any;
        const car = lease.car as any;
        await sendNotifyEmail(user.email, car.modelName, lease._id, timeLeft);

        lease.lastReminderSentAt = now;
        await lease.save();
      }
    }
  }
});

cron.schedule("*/5 * * * *", async () => {
  const now = new Date();

  
  const expiredLeases = await Lease.find({
    endDate: { $lt: now },
    status: "active",
  });

  if (!expiredLeases) return;
  

  for (const lease of expiredLeases) {
  
    lease.status = "expired";
    await lease.save();

 
    await Car.findByIdAndUpdate(
      lease.car,           
      { available: true },
      { new: true }         
    );

   
    const allCars = await Car.find({});
    await redisClient.setEx("AllCars:AllCars", 86400, JSON.stringify(allCars));

   
    const userLeases = await Lease.find({user: lease.user});

    if (userLeases.length > 0) {
      
      await redisClient.setEx(
        `leases:${lease.user}`,
        86400,
        JSON.stringify(userLeases)
      );
    } else {
      await redisClient.del(`leases:${lease.user}`);
    }
  }
});

}