import IORedis from 'ioredis';
export const connection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: 6379,
  password: undefined,
  maxRetriesPerRequest: null,
});
