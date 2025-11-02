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

const adminRouter = express.Router();

adminRouter.route("/car-listing").post(
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
  .post(attachUser, deleteLease);
adminRouter
  .route("/delete/car-listing/:id")
  .delete(attachUser, deleteCarListing);
adminRouter.route("/set-faqs").post(attachUser, setFAQs);
adminRouter.route("/set-policy").post(attachUser, setPrivacypolicy);
adminRouter.route("/recent-activity").get(attachUser, recentActivity);
adminRouter.get("/totalUserss", (req, res) => {
  res.json({ message: "Route works!" });
});

adminRouter.route("/totalUsers").get(attachUser, totalUsers);
adminRouter.route("/totalCars").get(attachUser, totalCars);
adminRouter.route("/activeLeases").get(attachUser, activeLeases);
adminRouter.route('/recent-cars').get(attachUser, getOneWeekAllCars)
adminRouter.route('/new-users').get(attachUser, getOneWeekUsers)
adminRouter.route('/active/users').get(attachUser, activeUsers)
adminRouter.route('/all/users').get(attachUser, AllUsers)
adminRouter.route('/delete/user/:id').delete(attachUser, deleteUser)
adminRouter.route('/user/details/:id').get(attachUser, userDetails)
adminRouter.route('/total-cars-for-car-management').get(attachUser, totalCarss)
adminRouter.route('/car-details/:id').get(attachUser, carDetails);
adminRouter.route('/user-complains').get(attachUser, userComplains);
adminRouter.route('/transactions').get(attachUser, transactions);
adminRouter.route('/update-car/:id').patch(attachUser, updateCar);

export { adminRouter };
