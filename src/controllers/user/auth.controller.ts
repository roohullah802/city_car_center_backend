import dotenv from "dotenv";
dotenv.config();
import { Request, Response } from "express";
import { redisClient } from "../../lib/redis/redis";
import { signupSchema } from "../../lib/zod/zod.signup";
import { User } from "../../models/user.model";
import bcrypt from "bcryptjs";
import jwt, {JwtPayload} from "jsonwebtoken";
import { loginSchema } from "../../lib/zod/zod.login";
import { resetPassSchema } from "../../lib/zod/zod.resetPass";
import { emailQueue } from "../../lib/mail/emailQueues";
import path from "path";
import fs from "fs/promises";
import axios from "axios";
import {jwtDecode} from 'jwt-decode'

function signToken(user: any) {
  return jwt.sign(
    { userId: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" }
  );
}

export async function googleAuth(req: Request, res: Response): Promise<void> {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      res.status(400).json({ success: false, message: "Missing idToken" });
      return;
    }

    // verify token with google
    const googleResp = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
    );

    const { sub, email, name, picture } = googleResp.data;

    const redisUser = await redisClient.get(`user:${email}`);
    let user;
    if (redisUser) {
      user = JSON.parse(redisUser)
    }else{
      user = await User.findOne({ provider: "google", providerId: sub });
    if (!user) {
      user = await User.create({
        provider: "google",
        providerId: sub,
        email,
        name,
        profile: picture,
      });
      req.io.emit('userAdded', user)
    }
    
    await redisClient.setEx(`user:${email}`, 86400, JSON.stringify(user));

    }

    const token = signToken(user);
    res.status(200).json({success: true, token, user });
  } catch (err: any) {
    console.error("Google auth error", err.response?.data || err.message);
    res.status(401).json({ success: false, message: "Invalid Google token" });
  }
}


export async function appleAuth(req: Request, res: Response): Promise<void> {
    try {
    const { idToken } = req.body;
    if (!idToken) {
      res.status(400).json({ message: "Missing idToken" });
      return;
    } 

    // Apple ID token is a JWT
    const decoded = jwtDecode(idToken);
    const { sub, email, fullName } = decoded as JwtPayload;

    let user = await User.findOne({ provider: "apple", providerId: sub });
    if (!user) {
      user = await User.create({
        provider: "apple",
        providerId: sub,
        email,
        name: fullName?.givenName || 'Apple user',
        profile: null,
      });
    }

    const token = signToken(user);
    res.status(200).json({success: true, token, user });
  } catch (err:any) {
    console.error("Apple auth error", err.message);
    res.status(401).json({ message: "Invalid Apple token" });
  }
}


export const validateToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader){
      res.status(401).json({ message: "No token" });
      return;
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    
    const redisUser = await redisClient.get(`user:${decoded.email}`);
    let user;
    if (redisUser) {
      user = JSON.parse(redisUser);
    }else{
      res.status(404).json({ message: "User not found" });
      return;
    }


    res.status(200).json({success: true,user});
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }
};


