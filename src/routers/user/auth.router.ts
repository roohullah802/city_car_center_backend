import express from 'express'
import {  googleAuth, appleAuth, validateToken } from '../../controllers/user/auth.controller'
import { authMiddleware } from '../../middleware/auth.middleware'
import uploadPDF from '../../lib/multer/pdf.multer'



const userAuthRouter = express.Router()

userAuthRouter.route("/google").post(googleAuth);
userAuthRouter.route("/apple").post(appleAuth);
userAuthRouter.route("/validate").post(validateToken);
export { userAuthRouter }