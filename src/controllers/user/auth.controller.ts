import dotenv from 'dotenv'
dotenv.config()
import { Request, Response } from 'express'
import { signupSchema } from '../../lib/zod/zod.signup'
import { User } from '../../models/user.model'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { sendEmail } from '../../lib/mail/nodemailer'





/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user
 * @access  Public
 */
export async function userSignup(req: Request, res: Response): Promise<void> {
    try {
        // ✅ Validate input
        const parsed = signupSchema.safeParse(req.body);

        if (!parsed.success) {
            res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: parsed.error.flatten().fieldErrors,
            });
            return;
        }

        const { firstName, lastName, email, phoneNo, password } = parsed.data;


        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(409).json({ success: false, message: 'User already exists with this email.' });
            return;
        }


        const user = new User({
            firstName,
            lastName,
            email,
            phoneNo,
            password,
        });

        await user.save();

        res.status(201).json({
            success: true,
            message: 'User registered successfully.',
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phoneNo: user.phoneNo,
            },
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ success: false, message: 'Internal server error. Please try again.' });
    }
}




/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return JWT token
 * @access  Public
 **/
export async function userLogin(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400).json({ success: false, message: "Email and password are required." });
        return;
    }

    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            res.status(401).json({ success: false, message: "Invalid email or password." });
            return;
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            res.status(401).json({ success: false, message: "Invalid email or password." });
            return;
        }

        const code = Math.floor(100000 + Math.random() * 900000);

        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET || "your_jwt_secret",
            { expiresIn: "1h" }
        );

        res.cookie('token', token).status(200).json({
            success: true,
            message: "Login successful.",
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phoneNo: user.phoneNo,
            },
        });
        user.verificationCode = code
        await user.save()
        await sendEmail(email, code)
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ success: false, message: "Server error. Please try again later." });
    }
}






/**
 * @route   POST /api/auth/logout
 * @desc    Logs out user by instructing client to delete token
 * @access  Public
 **/
export async function userLogout(req: Request, res: Response): Promise<void> {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
    });
    res.status(200).json({ success: true, message: "Logout successful." });

}





