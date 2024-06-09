import { Router } from "express";
// import { adminReg } from "../controllers/auth_controller.mjs";
// import { changePsswd } from "../controllers/auth_controller.mjs";
import { login } from "../controllers/auth_controller.mjs";

const router = Router();

router.post("/login", login);

// router.post("/adminReg", changePsswd);

export default router;