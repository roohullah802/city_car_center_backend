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
  adminSignup,
  adminLogin,
  userLogout,
  verifyEmail,
  resendEmailOtp,
  forgotPassword,
  matchOtp,
  resetPassword,
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
import {
  adminMiddleware,
  authMiddleware,
} from "../../middleware/auth.middleware";
import { compressAndResize, upload } from "../../lib/multer/multer";

const adminRouter = express.Router();

adminRouter.route("/signup").post(adminSignup);
adminRouter.route("/login").post(adminLogin);
adminRouter.route("/logout").post(authMiddleware,adminMiddleware,userLogout);
adminRouter.route("/verify-email").post(verifyEmail);
adminRouter.route("/resend-email-otp").post(resendEmailOtp);
adminRouter.route("/forgot-password").post(forgotPassword);
adminRouter.route("/match").post(matchOtp);
adminRouter.route("/reset-password").post(resetPassword);

adminRouter.route("/car-listing").post(
  authMiddleware,
  adminMiddleware
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
  .post(authMiddleware, adminMiddleware, deleteLease);
adminRouter
  .route("/delete/car-listing/:id")
  .delete(authMiddleware, adminMiddleware, deleteCarListing);
adminRouter.route("/set-faqs").post(authMiddleware,adminMiddleware,setFAQs);
adminRouter.route("/set-policy").post(authMiddleware,adminMiddleware,setPrivacypolicy);
adminRouter.route("/recent-activity").get(authMiddleware, adminMiddleware,recentActivity);
adminRouter.route("/totalUsers").get(authMiddleware, adminMiddleware,totalUsers);
adminRouter.route("/totalCars").get(authMiddleware,adminMiddleware,totalCars);
adminRouter.route("/activeLeases").get(authMiddleware,adminMiddleware,activeLeases);
adminRouter.route('/recent-cars').get(authMiddleware, adminMiddleware, getOneWeekAllCars)
adminRouter.route('/new-users').get(authMiddleware, adminMiddleware, getOneWeekUsers)
adminRouter.route('/active/users').get(authMiddleware, adminMiddleware, activeUsers)
adminRouter.route('/all/users').get(authMiddleware, adminMiddleware, AllUsers)
adminRouter.route('/delete/user/:id').delete(authMiddleware, adminMiddleware, deleteUser)
adminRouter.route('/user/details/:id').get(authMiddleware, adminMiddleware, userDetails)
adminRouter.route('/total-cars-for-car-management').get(authMiddleware, adminMiddleware, totalCarss)
adminRouter.route('/car-details/:id').get(authMiddleware, adminMiddleware, carDetails);
adminRouter.route('/user-complains').get(authMiddleware, adminMiddleware, userComplains);
adminRouter.route('/transactions').get(authMiddleware, adminMiddleware, transactions);
adminRouter.route('/update-car/:id').patch(authMiddleware, adminMiddleware, updateCar);

export { adminRouter };
