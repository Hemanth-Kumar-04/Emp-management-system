import { Router } from "express";
import { fetchAllNotifications, markAllNotificationAsSeen, clearNotification } from "../controllers/notification_controller.mjs";

const router = Router();

router.get("/fetchAllNotifications/:page", fetchAllNotifications);
router.patch("/markAllNotificationAsSeen", markAllNotificationAsSeen);
router.delete("/clearNotification", clearNotification);

export default router;
