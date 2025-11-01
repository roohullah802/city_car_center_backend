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
import {requireAuth} from '@clerk/express'

const adminRouter = express.Router();

adminRouter.route("/car-listing").post(
  requireAuth()
  ,
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "brandImage", maxCount: 1 },
  ]),
  compressAndResize,
  carListing
);
adminRouter
  .route("/delete/lease/:id")
  .post(requireAuth(), deleteLease);
adminRouter
  .route("/delete/car-listing/:id")
  .delete(requireAuth(), deleteCarListing);
adminRouter.route("/set-faqs").post(requireAuth(),setFAQs);
adminRouter.route("/set-policy").post(requireAuth(),setPrivacypolicy);
adminRouter.route("/recent-activity").get(requireAuth(),recentActivity);
adminRouter.route("/totalUsers").get(requireAuth(),totalUsers);
adminRouter.route("/totalCars").get(requireAuth(),totalCars);
adminRouter.route("/activeLeases").get(requireAuth(),activeLeases);
adminRouter.route('/recent-cars').get(requireAuth(), getOneWeekAllCars)
adminRouter.route('/new-users').get(requireAuth(), getOneWeekUsers)
adminRouter.route('/active/users').get(requireAuth(), activeUsers)
adminRouter.route('/all/users').get(requireAuth(), AllUsers)
adminRouter.route('/delete/user/:id').delete(requireAuth(), deleteUser)
adminRouter.route('/user/details/:id').get(requireAuth(), userDetails)
adminRouter.route('/total-cars-for-car-management').get(requireAuth(), totalCarss)
adminRouter.route('/car-details/:id').get(requireAuth(), carDetails);
adminRouter.route('/user-complains').get(requireAuth(), userComplains);
adminRouter.route('/transactions').get(requireAuth(), transactions);
adminRouter.route('/update-car/:id').patch(requireAuth(), updateCar);

export { adminRouter };
