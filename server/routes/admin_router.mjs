import { Router } from 'express';
import { updateAdmin } from '../controllers/admin_controller.mjs';

const router = Router();

router.patch("/updateAdmin", updateAdmin);

export default router;