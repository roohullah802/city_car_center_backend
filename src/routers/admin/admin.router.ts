import express from "express";
import {carListing} from '../../controllers/admin/admin.controller'
import { authMiddleware } from "../../middleware/auth.middleware";

const adminRouter = express.Router()

adminRouter.route("/car-listing").post(authMiddleware, carListing)


export {adminRouter}