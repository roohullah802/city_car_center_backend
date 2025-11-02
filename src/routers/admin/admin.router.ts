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
  .post(requireAuth(),attachUser, deleteLease);
adminRouter
  .route("/delete/car-listing/:id")
  .delete(requireAuth(),attachUser, deleteCarListing);
adminRouter.route("/set-faqs").post(requireAuth(),attachUser, setFAQs);
adminRouter.route("/set-policy").post(requireAuth(),attachUser, setPrivacypolicy);
adminRouter.route("/recent-activity").get(requireAuth(),attachUser, recentActivity);
adminRouter.get("/totalUserss", (req, res) => {
  res.json({ message: "Route works!" });
});

adminRouter.route("/totalUsers").get(requireAuth(),attachUser, totalUsers);
adminRouter.route("/totalCars").get(requireAuth(),attachUser, totalCars);
adminRouter.route("/activeLeases").get(requireAuth(),attachUser, activeLeases);
adminRouter.route('/recent-cars').get(requireAuth(),attachUser, getOneWeekAllCars)
adminRouter.route('/new-users').get(requireAuth(),attachUser, getOneWeekUsers)
adminRouter.route('/active/users').get(requireAuth(),attachUser, activeUsers)
adminRouter.route('/all/users').get(requireAuth(),attachUser, AllUsers)
adminRouter.route('/delete/user/:id').delete(requireAuth(),attachUser, deleteUser)
adminRouter.route('/user/details/:id').get(requireAuth(),attachUser, userDetails)
adminRouter.route('/total-cars-for-car-management').get(requireAuth(),attachUser, totalCarss)
adminRouter.route('/car-details/:id').get(requireAuth(),attachUser, carDetails);
adminRouter.route('/user-complains').get(requireAuth(),attachUser, userComplains);
adminRouter.route('/transactions').get(requireAuth(),attachUser, transactions);
adminRouter.route('/update-car/:id').patch(requireAuth(),attachUser, updateCar);

export { adminRouter };
