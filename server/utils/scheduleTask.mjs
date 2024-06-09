import schedule from "node-schedule";
import Employee from "../db/models/Employee.mjs";
import Notification from "../db/models/Notification.mjs";

// Schedule the task of resetting salary to run at 00:00 on the 1st day of every month
export const scheduleSalaryAndNotificationReset = () => {
  const job = schedule.scheduleJob("0 0 1 * *", async function () {
    // Reset the salary fields of each employee
    try {
      await Employee.updateMany(
        {},
        {
          "salary.deductions": 0,
          "salary.finalAmount": 0,
          "salary.lastUpdated": Date.now(),
        }
      );
      // notify the HR
      await Notification.deleteMany({});
      const notification = new Notification({
        message: "New salary cycle has started",
        date: Date.now(),
      });
      await notification.save();
    } catch (error) {
      console.error(error);
    }
  });
};

// automatically increase the salary of the employee each year
export const scheduleSalaryHike = () => {
  const job = schedule.scheduleJob("0 0 1 1 *", async function () {
    try {
      // Hike the salary of each employee
      await Employee.updateMany(
        {},
        {
          $mul: {
            "salary.base": { $add: [1, { $divide: ["$salary.hike", 100] }] },
          },
        }
      );
    } catch (error) {
      console.error(error);
    }
  });
};

// Schedule the task of creating notification
let notificationJobs = {}; // Object to store jobs

export const scheduleNotification = ({ id, message, date, employee }) => {
  // Schedule the job and store it in the jobs object
  notificationJobs[id] = schedule.scheduleJob(date, async function () {
    try {
      const [documentType, employeeId] = id.split("^");
      const employee = await Employee.findById(employeeId);
      const document = employee.documentType.filter(doc => doc.documentType === documentType);
      if(document.length === 0){
        return;
      }
      const notification = new Notification({
        message,
        pic: employee.profilePic,
        date,
        payload: {
          employee,
        },
      });
      await notification.save();
    } catch (error) {
      console.error(error);
    }
  });
};

export const cancelNotification = (id) => {
  if (notificationJobs[id]) {
    notificationJobs[id].cancel();
    delete notificationJobs[id]; // Remove the job from the jobs object
  }
}

export const reScheduleNotification = ({ id, message, date, employee }) => {
  cancelNotification(id);
  scheduleNotification({ id, message, date, employee });
};
