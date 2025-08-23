import {Queue} from 'bullmq'
import {Redis} from 'ioredis'
import {connection} from '../redis'

export const leaseReminderQueue = new Queue('leaseReminderQueue', {connection});