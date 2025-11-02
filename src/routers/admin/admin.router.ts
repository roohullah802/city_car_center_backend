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
  updateCar
} from "../../controllers/admin/admin.controller";
import { compressAndResize, upload } from "../../lib/multer/multer";
import { attachUser } from "../../lib/attachUser";
import {requireAuth} from '@clerk/express'
import { verifyClerkToken } from "../../lib/verifyClerkToken";

const adminRouter = express.Router();

adminRouter.route("/car-listing").post(
  requireAuth(),
  attachUser,
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "brandImage", maxCount: 1 },
  ]),
  compressAndResize,
  carListing
);
adminRouter
  .route("/delete/lease/:id")
  .post(verifyClerkToken, deleteLease);
adminRouter
  .route("/delete/car-listing/:id")
  .delete(verifyClerkToken, deleteCarListing);
adminRouter.route("/set-faqs").post(verifyClerkToken, setFAQs);
adminRouter.route("/set-policy").post(verifyClerkToken, setPrivacypolicy);
adminRouter.route("/recent-activity").get(verifyClerkToken, recentActivity);
adminRouter.route("/totalUsers").get(verifyClerkToken, totalUsers);
adminRouter.route("/totalCars").get(verifyClerkToken, totalCars);
adminRouter.route("/activeLeases").get(verifyClerkToken, activeLeases);
adminRouter.route('/recent-cars').get(verifyClerkToken, getOneWeekAllCars)
adminRouter.route('/new-users').get(verifyClerkToken, getOneWeekUsers)
adminRouter.route('/active/users').get(verifyClerkToken, activeUsers)
adminRouter.route('/all/users').get(verifyClerkToken, AllUsers)
adminRouter.route('/delete/user/:id').delete(verifyClerkToken, deleteUser)
adminRouter.route('/user/details/:id').get(verifyClerkToken, userDetails)
adminRouter.route('/total-cars-for-car-management').get(verifyClerkToken, totalCarss)
adminRouter.route('/car-details/:id').get(verifyClerkToken, carDetails);
adminRouter.route('/user-complains').get(verifyClerkToken, userComplains);
adminRouter.route('/transactions').get(verifyClerkToken, transactions);
adminRouter.route('/update-car/:id').patch(verifyClerkToken, updateCar);

export { adminRouter };
