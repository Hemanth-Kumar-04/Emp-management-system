import { Router } from "express";
import { fetchAllApplications } from "../controllers/application_controller.mjs";
import { rejectLeave } from "../controllers/application_controller.mjs";
import { approveLeave } from "../controllers/application_controller.mjs";
import { uploadApplication } from "../controllers/application_controller.mjs";

const router = Router();

router.post("/uploadApplication", uploadApplication);
router.patch("/approveLeave/:id", approveLeave);
router.patch("/rejectLeave/:id", rejectLeave);
router.get("/fetchAllApplications/:page/:rowsPerPage", fetchAllApplications);

export default router;