import { Router } from "express";
import { fetchAdminSummary } from "../controllers/summary_controller.mjs";

const router = Router();

router.get("/fetchAdminSummary", fetchAdminSummary);

export default router;