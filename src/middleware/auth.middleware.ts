import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import {JwtPayload} from '../types/jwt'
dotenv.config()

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const token = req.cookies?.token

    if (!token){
        res.status(401).json({ message: 'Access token missing' })
        return;
    };

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
        req.user = decoded
        next();
    } catch (err) {
        res.status(403).json({ message: 'Invalid token' });
        return;
    }
}

export {authMiddleware}
