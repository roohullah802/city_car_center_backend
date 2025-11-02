import express from "express";
import {
  getCarDetails,
  getAllCars,
  getPaymentDetails,
  returnCar,
  getAllBrands,
  getAllFAQs,
  reportIssue,
  getAllPolicy,
  getAllActiveLeases,
  leaseDetails,
  getAllLeases,
} from "../../controllers/user/user.controller";
import uploadPDF from "../../lib/multer/pdf.multer";
import { verifyClerkToken } from "../../middleware/verifyClerkToken";

const userRouter = express.Router();

userRouter.route("/car/details/:id").get(getCarDetails);
userRouter.route("/all/cars").get(getAllCars);
userRouter.route("/all/brands").get(getAllBrands);
userRouter
  .route("/car/payment/history")
  .get(verifyClerkToken, getPaymentDetails);
userRouter
  .route("/car/return/:id")
  .post(verifyClerkToken, uploadPDF.single("pdf"), returnCar);
userRouter.route("/all/faqs").get(getAllFAQs);
userRouter.route("/all/policy").get(getAllPolicy);
userRouter.route("/report/issue").post(verifyClerkToken, reportIssue);
userRouter
  .route("/all/active/leases")
  .get(verifyClerkToken, getAllActiveLeases);
userRouter.route("/leases").get(verifyClerkToken, getAllLeases);
userRouter
  .route("/lease/details/:id")
  .get(verifyClerkToken, leaseDetails);

export { userRouter };
