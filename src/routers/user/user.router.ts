import express from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import { getCarDetails, getAllCars, createLease, extendLease, getPaymentDetails, returnCar } from '../../controllers/user/user.controller'
const userRouter = express.Router()

userRouter.route("/car/details/:id").get(authMiddleware, getCarDetails)
userRouter.route("/all/cars").get(authMiddleware, getAllCars)
userRouter.route("/car/create-lease/:id").post(authMiddleware, createLease)
userRouter.route("/car/extend-lease/:id").post(authMiddleware, extendLease)
userRouter.route("/car/payment/history").get(authMiddleware, getPaymentDetails)
userRouter.route("/car/return/:id").post(authMiddleware, returnCar)


export { userRouter }