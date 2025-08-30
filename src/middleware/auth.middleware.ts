import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import {JwtPayload} from '../types/jwt'
import dotenv from 'dotenv'
dotenv.config()

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const authorizationHeader = req.headers['authorization'];


   
    if (!authorizationHeader){
        res.status(401).json({ message: 'Authorization header missing' })
        return;
    };

    const token = authorizationHeader.split(' ')[1];

     if (!token) {
        res.status(401).json({ message: 'Bearer token missing' });
        return;
    }

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
