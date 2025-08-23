import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import {connection} from './redis'


export const emailQueue = new Queue('emailQueue', {
  connection,
});

