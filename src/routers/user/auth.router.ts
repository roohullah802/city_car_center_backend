import express from 'express'
import { userSignup, userLogin, userLogout, verifyEmail, resendEmailOtp, forgotPassword, resetPassword, matchOtp } from '../../controllers/user/auth.controller'
import { authMiddleware } from '../../middleware/auth.middleware'



const userAuthRouter = express.Router()

userAuthRouter.route("/signup").post(userSignup)
userAuthRouter.route("/login").post(userLogin)
userAuthRouter.route("/logout").post(authMiddleware, userLogout)
userAuthRouter.route("/verify-email").post(verifyEmail)
userAuthRouter.route("/resend-otp").post(resendEmailOtp)
userAuthRouter.route("/forgot-password").post(forgotPassword)
userAuthRouter.route("/match-otp").post(matchOtp)
userAuthRouter.route("/reset-password").post(resetPassword)

export { userAuthRouter }