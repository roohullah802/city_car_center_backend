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
  uploadDocuments
} from "../../controllers/user/user.controller";
import uploadPDF from "../../lib/multer/pdf.multer";
import { verifyClerkToken } from "../../middleware/verifyClerkToken";
import { compressAndResize, upload } from "../../lib/multer/multer";

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

userRouter.route('/upload/documents').post(verifyClerkToken,upload.fields([{name: 'drivingLicence', maxCount:1},
  {name: 'cnicFront', maxCount: 1},
  {name: 'cnicBack', maxCount: 1},
  {name: 'extraDocuments', maxCount: 10}
]),compressAndResize, uploadDocuments)  

export { userRouter };
