import dotenv from 'dotenv'
dotenv.config()
import { Request, Response } from 'express'
import { signupSchema } from '../../lib/zod/zod.signup'
import { User } from '../../models/user.model'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { sendEmail } from '../../lib/mail/nodemailer'
import { loginSchema } from '../../lib/zod/zod.login'
import { resetPassSchema } from '../../lib/zod/zod.resetPass'





/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user
 * @access  Public
 */
export async function userSignup(req: Request, res: Response): Promise<void> {
    ``
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
        const code = Math.floor(100000 + Math.random() * 900000);

        user.verificationCode = code
        await user.save();
        await sendEmail(email, code)

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
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: parsed.error.flatten().fieldErrors,
        });
        return;
    }

    const { email, password } = parsed.data;


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


        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET!,
            { expiresIn: "7d" }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
          }).status(200).json({
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
        await user.save()
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







/**
 * @route   POST /api/auth/verify-email
 * @desc    Verifies the 6-digit code sent to user's email
 * @access  Public
 */
export async function verifyEmail(req: Request, res: Response): Promise<void> {
    const { email, code } = req.body;

    if (!email || !code) {
        res.status(400).json({ success: false, message: "Email and code are required." });
        return;
    }

    try {
        const user = await User.findOne({ email });

        if (!user) {
            res.status(404).json({ success: false, message: "User not found." });
            return;
        }

        if (user.verificationCode !== code) {
            res.status(400).json({ success: false, message: "Invalid or expired verification code." });
            return;
        }

        // Mark user as verified and clear code
        user.isVerified = true;
        user.verificationCode = undefined;
        await user.save();

        res.status(200).json({ success: true, message: "Email verified successfully." });
    } catch (error) {
        console.error("Verification error:", error);
        res.status(500).json({ success: false, message: "Failed to verify email." });
    }
}








/**
 * @route   POST /api/auth/resend-otp
 * @desc    Resends a 6-digit email verification code to the authenticated user
 * @access  Private
 */
export async function resendEmailOtp(req: Request, res: Response): Promise<void> {

    type EmailType = {
        email: string
    }

    const { email } = req.body as EmailType

    if (!email) {
        res.status(401).json({ success: false, message: "Unauthorized. Please login first." });
        return;
    }

    try {
        const user = await User.findOne({ email: email });

        if (!user) {
            res.status(404).json({ success: false, message: "User not found." });
            return;
        }

        if (user.isVerified) {
            res.status(400).json({ success: false, message: "Email is already verified." });
            return;
        }

        // Generate new 6-digit code
        const newCode = Math.floor(100000 + Math.random() * 900000);

        // Update user with new code and expiry (15 minutes)
        user.verificationCode = newCode;
        await user.save();
        await sendEmail(email, newCode)

        res.status(200).json({
            success: true,
            message: "Verification code resent to your email.",
        });
    } catch (error) {
        console.error("Resend OTP error:", error);
        res.status(500).json({ success: false, message: "Failed to resend verification code." });
    }
}








/**
 * @route   POST /api/auth/forgot-password
 * @desc    Initiates forgot password process by generating a reset token and sending it to user's email
 * @access  Public
 */
export async function forgotPassword(req: Request, res: Response): Promise<void> {

    type Email = {
        email: string
    }


    const { email } = req.body as Email

    if (!email) {
        res.status(400).json({ success: false, message: "Email is required." });
        return;
    }

    try {
        const user = await User.findOne({ email });

        if (!user) {
            res.status(200).json({ success: true, message: "If the email exists, a reset link has been sent." });
            return;
        }


        const newCode = Math.floor(100000 + Math.random() * 900000);


        user.verificationCode = newCode;
        await user.save();
        await sendEmail(email, newCode)

        res.status(200).json({ success: true, message: "verification code successfully sent to your email" });
    } catch (error) {
        console.error("Forgot Password error:", error);
        res.status(500).json({ success: false, message: "Failed to process password reset request." });
    }
}




export async function matchOtp(req: Request, res: Response): Promise<void> {
    const { email, code } = req.body

    if (!email || !code) {
        res.status(400).json({ success: false, message: "verification code and email is required" })
        return;
    }
    const user = await User.findOne({ email: email })
    if (!user) {
        res.status(400).json({ success: false, message: "user not found" })
        return;
    }

    if (user.verificationCode !== code) {
        res.status(400).json({ success: false, message: "password is not matched" })
        return;
    }

    res.status(200).json({ success: false, message: "password matched successfully" })

}





/**
 * @route   POST /api/auth/reset-password
 * @desc    Resets user's password using email
 * @access  Public
 */
export async function resetPassword(req: Request, res: Response): Promise<void> {
    const parsed = resetPassSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: parsed.error.flatten().fieldErrors,
        });
        return;
    }

    const { email, newPassword, reNewPassword } = parsed.data;


    if (newPassword !== reNewPassword) {
        res.status(400).json({ success: false, message: "please enter correct password!" });
        return;
    }

    if (!email || !newPassword || !reNewPassword) {
        res.status(400).json({ success: false, message: "Email, token, and new password are required." });
        return;
    }

    try {
        // Find user by email and valid reset token
        const user = await User.findOne({ email });

        if (!user) {
            res.status(400).json({ success: false, message: "Invalid or expired password reset token." });
            return;
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password and clear reset token fields
        user.password = hashedPassword;
        user.verificationCode = undefined;
        await user.save();

        res.status(200).json({ success: true, message: "Password has been reset successfully." });
    } catch (error) {
        console.error("Reset Password error:", error);
        res.status(500).json({ success: false, message: "Failed to reset password." });
    }
}
