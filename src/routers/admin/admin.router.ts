import express from "express";
import {
  carListing,
  deleteLease,
  deleteCarListing,
  setFAQs,
  setPrivacypolicy,
} from "../../controllers/admin/admin.controller";
import { adminMiddleware, authMiddleware } from "../../middleware/auth.middleware";
import { compressAndResize, upload } from "../../lib/multer/multer";

const adminRouter = express.Router();

adminRouter.route("/car-listing").post(
  authMiddleware,
  adminMiddleware,
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "brandImage", maxCount: 1 },
  ]),
  compressAndResize,
  carListing
);
adminRouter.route("/delete/lease/:id").post(authMiddleware,adminMiddleware, deleteLease);
adminRouter
  .route("/delete/car-listing/:id")
  .post(authMiddleware,adminMiddleware, deleteCarListing);
adminRouter.route("/set-faqs").post(authMiddleware,adminMiddleware, setFAQs);
adminRouter.route("/set-policy").post(authMiddleware,adminMiddleware, setPrivacypolicy);

export { adminRouter };
