import { Router } from "express";
import { removeDepartment } from "../controllers/department_controller.mjs";
import { updateDepartment } from "../controllers/department_controller.mjs";
import {
  createDepartment,
  fetchAllDepartments,
} from "../controllers/department_controller.mjs";

const router = Router();

router.post("/createDepartment", createDepartment);
router.get("/fetchAllDepartments", fetchAllDepartments);
router.put("/updateDepartment/:id", updateDepartment);
router.delete("/removeDepartment/:id", removeDepartment);

export default router;
