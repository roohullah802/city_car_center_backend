import express from 'express'
import { userLogout, userProfile, googleAuth, appleAuth } from '../../controllers/user/auth.controller'
import { authMiddleware } from '../../middleware/auth.middleware'
import uploadPDF from '../../lib/multer/pdf.multer'



const userAuthRouter = express.Router()

userAuthRouter.route("/google").post(googleAuth);
userAuthRouter.route("/apple").post(appleAuth);
userAuthRouter.route("/logout").post(authMiddleware, userLogout)
userAuthRouter.route("/update/profile").post(authMiddleware,uploadPDF.single('file'), userProfile)

export { userAuthRouter }