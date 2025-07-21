import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/db/mongodb";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { userAuthRouter } from "./src/routers/user/auth.router";
import { userRouter } from "./src/routers/user/user.router";
import { adminRouter } from "./src/routers/admin/admin.router";
import { webhookHandler } from "./src/lib/webhook";
import { connectRedis } from "./src/lib/redis/redis";
dotenv.config();
connectRedis();

const app = express();

const corsOptions = {
  origin: [
    "http://localhost:3000", // React.js (local dev)
    "http://127.0.0.1:3000", // alternate localhost
    "http://localhost:19006", // React Native Web (Expo)
    "http://localhost:8081", // React Native CLI
    "exp://127.0.0.1:19000", // Expo Go App
    // "your-frontend-domain.com",   // Production frontend
  ],
  credentials: true, // If you're using cookies or auth headers
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/api/user/auth", userAuthRouter);
app.use("/api/user", userRouter);
app.use("/api/admin", adminRouter);
app.post(
  "/api/payment/webhook",
  bodyParser.raw({ type: "application/json" }),
  webhookHandler
);

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI! || "", {})
  .then(() => {
    connectDB();
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
  });
