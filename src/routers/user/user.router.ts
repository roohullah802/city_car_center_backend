import express from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import { getCarDetails, getAllCars,  extendLease, getPaymentDetails, returnCar, getAllBrands, getAllFAQs, reportIssue, getAllPolicy, getAllLeases, leaseDetails, createLease } from '../../controllers/user/user.controller'
import uploadPDF from '../../lib/multer/pdf.multer'
const userRouter = express.Router()

userRouter.route("/car/details/:id").get(authMiddleware, getCarDetails)
userRouter.route("/all/cars").get(authMiddleware, getAllCars)
userRouter.route("/all/brands").get(authMiddleware, getAllBrands)
userRouter.route("/car/extend-lease/:id").post(authMiddleware, extendLease)
userRouter.route("/create-lease/:id").post(authMiddleware, createLease)
userRouter.route("/car/payment/history").get(authMiddleware, getPaymentDetails)
userRouter.route("/car/return/:id").post(authMiddleware, uploadPDF.single("pdf") , returnCar)
userRouter.route("/all/faqs").get(getAllFAQs)
userRouter.route("/all/policy").get(getAllPolicy)
userRouter.route("/report/issue").post(authMiddleware, reportIssue)
userRouter.route('/all/leases').get(authMiddleware, getAllLeases)
userRouter.route('/lease/details/:id').get(authMiddleware, leaseDetails)

export { userRouter }