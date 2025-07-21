import { createClient } from 'redis';
import dotenv from 'dotenv'
dotenv.config()

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  // socket: { tls: true },         // optional, for SSL
  // password: process.env.REDIS_PASSWORD, // optional, for auth
});

redisClient.on('error', (err) => {
  console.error('❌ Redis Client Error:', err);
});

const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log('✅ Redis connected');
  }
};

export { redisClient, connectRedis };
