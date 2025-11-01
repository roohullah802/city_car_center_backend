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
import {ClerkExpressRequireAuth} from '@clerk/clerk-sdk-node'

const adminRouter = express.Router();

adminRouter.route("/car-listing").post(
  ClerkExpressRequireAuth() as unknown as express.RequestHandler
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
  .post(ClerkExpressRequireAuth() as unknown as express.RequestHandler, deleteLease);
adminRouter
  .route("/delete/car-listing/:id")
  .delete(ClerkExpressRequireAuth() as unknown as express.RequestHandler, deleteCarListing);
adminRouter.route("/set-faqs").post(ClerkExpressRequireAuth() as unknown as express.RequestHandler,setFAQs);
adminRouter.route("/set-policy").post(ClerkExpressRequireAuth() as unknown as express.RequestHandler,setPrivacypolicy);
adminRouter.route("/recent-activity").get(ClerkExpressRequireAuth() as unknown as express.RequestHandler,recentActivity);
adminRouter.route("/totalUsers").get(ClerkExpressRequireAuth() as unknown as express.RequestHandler,totalUsers);
adminRouter.route("/totalCars").get(ClerkExpressRequireAuth() as unknown as express.RequestHandler,totalCars);
adminRouter.route("/activeLeases").get(ClerkExpressRequireAuth() as unknown as express.RequestHandler,activeLeases);
adminRouter.route('/recent-cars').get(ClerkExpressRequireAuth() as unknown as express.RequestHandler, getOneWeekAllCars)
adminRouter.route('/new-users').get(ClerkExpressRequireAuth() as unknown as express.RequestHandler, getOneWeekUsers)
adminRouter.route('/active/users').get(ClerkExpressRequireAuth() as unknown as express.RequestHandler, activeUsers)
adminRouter.route('/all/users').get(ClerkExpressRequireAuth() as unknown as express.RequestHandler, AllUsers)
adminRouter.route('/delete/user/:id').delete(ClerkExpressRequireAuth() as unknown as express.RequestHandler, deleteUser)
adminRouter.route('/user/details/:id').get(ClerkExpressRequireAuth() as unknown as express.RequestHandler, userDetails)
adminRouter.route('/total-cars-for-car-management').get(ClerkExpressRequireAuth() as unknown as express.RequestHandler, totalCarss)
adminRouter.route('/car-details/:id').get(ClerkExpressRequireAuth() as unknown as express.RequestHandler, carDetails);
adminRouter.route('/user-complains').get(ClerkExpressRequireAuth() as unknown as express.RequestHandler, userComplains);
adminRouter.route('/transactions').get(ClerkExpressRequireAuth() as unknown as express.RequestHandler, transactions);
adminRouter.route('/update-car/:id').patch(ClerkExpressRequireAuth() as unknown as express.RequestHandler, updateCar);

export { adminRouter };
