import dotenv from 'dotenv'
dotenv.config()
module.exports = {
  apps: [
    {
      name: "city_car_center_backend",
      script: "dist/index.js",
      cwd: "/var/www/city_car_center_backend",
      env: {
        PORT: process.env.PORT || 5000,
        CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
        CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
        CLERK_WEBHOOK_SECRET:process.env.CLERK_WEBHOOK_SECRET,
        MONGODB_URI:process.env.MONGODB_URI,
        JWT_SECRET:process.env.JWT_SECRET,
        STRIPE_SERVER_KEY:process.env.STRIPE_SERVER_KEY,
        STRIPE_WEBHOOK_SECRET:process.env.STRIPE_WEBHOOK_SECRET,
        SMTP_HOST:process.env.SMTP_HOST,
        SMTP_PORT: process.env.SMTP_PORT || 587,
        SMTP_USER:process.env.SMTP_USER,
        SMTP_PASS:process.env.SMTP_PASS,
        REDIS_URL:process.env.REDIS_URL
        ,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 5000
      }
    }
  ]
};
