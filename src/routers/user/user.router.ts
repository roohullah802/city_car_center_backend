import express from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import { getCarDetails, getAllCars, createLease, extendLease, getPaymentDetails } from '../../controllers/user/user.controller'
const userRouter = express.Router()

userRouter.route("/car/details/:id").get(authMiddleware, getCarDetails)
userRouter.route("/all/cars").get(authMiddleware, getAllCars)
userRouter.route("/car/create-lease/:id").post(authMiddleware, createLease)
userRouter.route("/car/extend-lease/:id").post(authMiddleware, extendLease)
userRouter.route("/car/payment/history").post(authMiddleware, getPaymentDetails)


export { userRouter }