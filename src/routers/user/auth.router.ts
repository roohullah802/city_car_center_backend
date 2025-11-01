import express from 'express'
import {  googleAuth, appleAuth, validateToken, userLogout } from '../../controllers/user/auth.controller'
import { attachUser } from '../../lib/attachUser';
import {requireAuth} from '@clerk/express'
// import { authMiddleware } from '../../middleware/auth.middleware';



const userAuthRouter = express.Router()

userAuthRouter.route("/google").post(googleAuth);
userAuthRouter.route("/apple").post(appleAuth);
userAuthRouter.route('/logout').post(requireAuth(), attachUser,userLogout);
userAuthRouter.route("/validate").post(validateToken);
export { userAuthRouter }