import express from 'express'
import { getCarDetails, getAllCars, getPaymentDetails, returnCar, getAllBrands, getAllFAQs, reportIssue, getAllPolicy, getAllActiveLeases, leaseDetails, getAllLeases } from '../../controllers/user/user.controller'
import uploadPDF from '../../lib/multer/pdf.multer'
import {requireAuth} from '@clerk/express'
import { attachUser } from '../../lib/attachUser'
const userRouter = express.Router()

userRouter.route("/car/details/:id").get(getCarDetails)
userRouter.route("/all/cars").get(getAllCars)
userRouter.route("/all/brands").get(getAllBrands)
userRouter.route("/car/payment/history").get(requireAuth(), attachUser, getPaymentDetails)
userRouter.route("/car/return/:id").post(requireAuth(), attachUser, uploadPDF.single("pdf") , returnCar)
userRouter.route("/all/faqs").get(getAllFAQs)
userRouter.route("/all/policy").get(getAllPolicy)
userRouter.route("/report/issue").post(requireAuth(), attachUser, reportIssue)
userRouter.route('/all/active/leases').get(requireAuth(),attachUser, getAllActiveLeases)
userRouter.route('/leases').get(requireAuth(),attachUser,getAllLeases);
userRouter.route('/lease/details/:id').get(requireAuth(),attachUser, leaseDetails)

export { userRouter }