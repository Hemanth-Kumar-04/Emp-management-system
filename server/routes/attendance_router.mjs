import { Router } from "express";
import { fetchAttendance } from "../controllers/attendance_controller.mjs";
import { uploadAttendance } from "../controllers/attendance_controller.mjs";

const router = Router();

router.post("/uploadAttendance", uploadAttendance);
router.get("/fetchAttendance/:id/:page/:rowsPerPage", fetchAttendance);

export default router;