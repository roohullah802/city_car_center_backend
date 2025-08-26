import express from "express";
import { carListing, deleteLease, deleteCarListing, setFAQs, setPrivacypolicy } from '../../controllers/admin/admin.controller'
import { authMiddleware, } from "../../middleware/auth.middleware";
import {upload} from '../../lib/multer/multer';

const adminRouter = express.Router()

adminRouter.route("/car-listing").post(authMiddleware, upload.fields([{ name: "images", maxCount: 5 }, { name: "brandImage", maxCount: 1 }]), carListing)
adminRouter.route("/delete/lease/:id").post(authMiddleware, deleteLease)
adminRouter.route("/delete/car-listing/:id").post(authMiddleware, deleteCarListing)
adminRouter.route("/set-faqs").post(authMiddleware,setFAQs)
adminRouter.route("/set-policy").post(authMiddleware,setPrivacypolicy)


export { adminRouter }