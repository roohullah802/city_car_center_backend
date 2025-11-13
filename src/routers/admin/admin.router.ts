import express from "express";
import {
  carListing,
  deleteLease,
  deleteCarListing,
  setFAQs,
  setPrivacypolicy,
  recentActivity,
  totalUsers,
  totalCars,
  activeLeases,
  getOneWeekAllCars,
  getOneWeekUsers,
  activeUsers,
  AllUsers,
  deleteUser,
  userDetails,
  totalCarss,
  carDetails,
  userComplains,
  transactions,
  updateCar,
  getPendingAdminUsers,
  getAdminStatus,
  adminApprove,
  adminDisApproved,
  userDocuments,
  adminApproveDocuments,
  adminRejectDocuments
} from "../../controllers/admin/admin.controller";
import { compressAndResize, upload } from "../../lib/multer/multer";
import { verifyClerkToken } from "../../middleware/verifyClerkToken";
import { requireAdmin } from "../../middleware/requireAmin";

const adminRouter = express.Router();

adminRouter.route("/car-listing").post(
  verifyClerkToken,
  requireAdmin,
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "brandImage", maxCount: 1 },
  ]),
  compressAndResize,
  carListing
);
adminRouter.route("/delete/lease/:id").post(verifyClerkToken,requireAdmin, deleteLease);
adminRouter
  .route("/delete/car-listing/:id")
  .delete(verifyClerkToken,requireAdmin, deleteCarListing);
adminRouter.route("/set-faqs").post(verifyClerkToken,requireAdmin, setFAQs);
adminRouter.route("/set-policy").post(verifyClerkToken,requireAdmin, setPrivacypolicy);
adminRouter.route("/recent-activity").get(verifyClerkToken,requireAdmin, recentActivity);
adminRouter.route("/totalUsers").get(verifyClerkToken,requireAdmin, totalUsers);
adminRouter.route("/totalCars").get(verifyClerkToken,requireAdmin, totalCars);
adminRouter.route("/activeLeases").get(verifyClerkToken,requireAdmin, activeLeases);
adminRouter.route("/recent-cars").get(verifyClerkToken,requireAdmin, getOneWeekAllCars);
adminRouter.route("/new-users").get(verifyClerkToken,requireAdmin, getOneWeekUsers);
adminRouter.route("/active/users").get(verifyClerkToken,requireAdmin, activeUsers);
adminRouter.route("/all/users").get(verifyClerkToken,requireAdmin, AllUsers);
adminRouter.route("/delete/user/:id").delete(verifyClerkToken,requireAdmin, deleteUser);
adminRouter.route("/user/details/:id").get(verifyClerkToken,requireAdmin, userDetails);
adminRouter
  .route("/total-cars-for-car-management")
  .get(verifyClerkToken,requireAdmin, totalCarss);
adminRouter.route("/car-details/:id").get(verifyClerkToken,requireAdmin, carDetails);
adminRouter.route("/user-complains").get(verifyClerkToken,requireAdmin, userComplains);
adminRouter.route("/transactions").get(verifyClerkToken,requireAdmin, transactions);
adminRouter.route("/update-car/:id").patch(verifyClerkToken,requireAdmin, updateCar);
adminRouter.route('/get-pending-admin-users').get(verifyClerkToken, requireAdmin, getPendingAdminUsers);
adminRouter.route('/status').get(verifyClerkToken, getAdminStatus);
adminRouter.route('/approve/:id').post(verifyClerkToken,requireAdmin,adminApprove);
adminRouter.route('/disApprove/:id').post(verifyClerkToken, requireAdmin, adminDisApproved);
adminRouter.route('/user/documents').get(verifyClerkToken,requireAdmin, userDocuments);
adminRouter.route('/approve/documents/:id').post(verifyClerkToken, requireAdmin, adminApproveDocuments);
adminRouter.route('/reject/documents/:id').post(verifyClerkToken, requireAdmin, adminRejectDocuments);

export { adminRouter };
