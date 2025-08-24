import { Queue } from 'bullmq';
import {connection} from './redis'


export const emailQueue = new Queue('emailQueue', {
  connection,
});
console.log('Added to emailQueue')
