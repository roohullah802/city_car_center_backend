import express from 'express'
import { getCarDetails, getAllCars, getPaymentDetails, returnCar, getAllBrands, getAllFAQs, reportIssue, getAllPolicy, getAllActiveLeases, leaseDetails, getAllLeases } from '../../controllers/user/user.controller'
import uploadPDF from '../../lib/multer/pdf.multer'
import { attachUser } from '../../lib/attachUser'
const userRouter = express.Router()

userRouter.route("/car/details/:id").get(getCarDetails)
userRouter.route("/all/cars").get(getAllCars)
userRouter.route("/all/brands").get(getAllBrands)
userRouter.route("/car/payment/history").get(attachUser, getPaymentDetails)
userRouter.route("/car/return/:id").post(attachUser, uploadPDF.single("pdf") , returnCar)
userRouter.route("/all/faqs").get(getAllFAQs)
userRouter.route("/all/policy").get(getAllPolicy)
userRouter.route("/report/issue").post(attachUser, reportIssue)
userRouter.route('/all/active/leases').get(attachUser, getAllActiveLeases)
userRouter.route('/leases').get(attachUser, getAllLeases);
userRouter.route('/lease/details/:id').get(attachUser, leaseDetails)

export { userRouter }