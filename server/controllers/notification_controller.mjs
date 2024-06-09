import fetchCredentials from "../middleware/fetchCredentials.mjs";
import Admin from "../db/models/Admin.mjs";
import Employee from "../db/models/Employee.mjs";
import Notification from "../db/models/Notification.mjs";

export const fetchAllNotifications = [
  fetchCredentials,
  async (req, res) => {
    try {
      const limit = 5;
      const { page } = req.params;
      let filter;
      const admin = await Admin.findById(req.credential.id);
      if (!admin) {
        const employee = await Employee.findById(req.credential.id);
        if (!employee) {
          return res.status(403).json({ error: "Access Denied" });
        }
        filter = { to: employee._id };
      } else {
        filter = { to: { $exists: false } };
      }
      const notifications = await Notification.find(filter)
        .sort({ date: -1 })
        .skip(limit * page)
        .limit(limit);
      return res.status(200).json({ notifications });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
];

export const markAllNotificationAsSeen = [
  fetchCredentials,
  async (req, res) => {
    try {
      const admin = await Admin.findById(req.credential.id);
      if (!admin) {
        const employee = await Employee.findById(req.credential.id, '_id');
        if(!employee){
          return res.status(403).json({ error: "Access Denied" });
        }
        await Notification.updateMany({ status: "Unseen", to: employee._id }, { status: "Seen" });
        return res.status(200).json({message: "Marked as read"});
      }
      await Notification.updateMany({ status: "Unseen", to: {$exists: false} }, { status: "Seen" });
      return res.status(200).json({message: "Marked as read"});
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
];

export const clearNotification = [
  fetchCredentials,
  async (req, res) => {
    try {
      const admin = await Admin.findById(req.credential.id);
      if (!admin) {
        return res.status(403).json({ error: "Access Denied" });
      }
      await Notification.deleteMany({});
      return res.sendStatus(204);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
];
