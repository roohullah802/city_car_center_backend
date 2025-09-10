import express from 'express'
import { userSignup, userLogin, userLogout, verifyEmail, resendEmailOtp, forgotPassword, resetPassword, matchOtp, userProfile, changeUserPassword, resndCode, googleAuth, appleAuth } from '../../controllers/user/auth.controller'
import { authMiddleware } from '../../middleware/auth.middleware'
import uploadPDF from '../../lib/multer/pdf.multer'



const userAuthRouter = express.Router()

// userAuthRouter.route("/signup").post(userSignup)
// userAuthRouter.route("/login").post(userLogin)
userAuthRouter.route("/google").post(googleAuth);
userAuthRouter.route("/apple").post(appleAuth);
userAuthRouter.route("/logout").post(authMiddleware, userLogout)
userAuthRouter.route("/verify-email").post(verifyEmail)
userAuthRouter.route("/resend-otp").post(resendEmailOtp)
userAuthRouter.route("/forgot-password").post(forgotPassword)
userAuthRouter.route("/match-otp").post(matchOtp)
userAuthRouter.route("/reset-password").post(resetPassword)
userAuthRouter.route("/update/profile").post(authMiddleware,uploadPDF.single('file'), userProfile)
userAuthRouter.route("/update/app/password").post(authMiddleware, changeUserPassword)
userAuthRouter.route("/resnd-code").post(resndCode)

export { userAuthRouter }