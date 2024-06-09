import fetchCredentials from "../middleware/fetchCredentials.mjs";
import validateErrors from "../middleware/validateErrors.mjs";
import Admin from "../db/models/Admin.mjs";
import Employee from "../db/models/Employee.mjs";
import { body } from "express-validator";
import { DATE_FORMAT } from "../constants/date_constants.mjs";
import { FILE_SIZE, FILE_FORMAT } from "../constants/file_constants.mjs";
import moment from "moment";
import multer from "multer";
import LeaveApplication from "../db/models/LeaveApplication.mjs";
import { isValidObjectId } from "mongoose";
import Notification from "../db/models/Notification.mjs";
import path from "path";

// document file type validation
const upload = multer({
  limits: {
    fileSize: FILE_SIZE, // limit file size to 1MB
  },
  fileFilter: function (req, file, cb) {
    // Array of allowed file types
    const filetypes = FILE_FORMAT;
    // Check file type
    const mimetype = filetypes.test(file.mimetype);
    // Check file extension
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(
        "Error: File upload only supports the following filetypes - " +
          filetypes
      );
    }
  },
});

export const uploadApplication = [
  // validate incoming data
  upload.single("document"),
  body("employeeId").custom((value) => {
    if (value && isValidObjectId(value)) {
      return true;
    }
    throw new Error("Employee ID is required");
  }),
  body("leaveType")
    .exists()
    .isIn(["Sick Leave", "Personal Leave", "Others"])
    .withMessage("Leave type can only be Sick, Personal or Others"),
  body("fromDate")
    .exists()
    .custom((value) => {
      if (!value) {
        throw new Error("Date of leave is required");
      } else {
        const isValidDate = moment(value, DATE_FORMAT, true).isValid();
        if (isValidDate) {
          return true;
        }
        throw new Error("Date must be in DD/MM/YYYY format");
      }
    }),
  body("toDate")
    .exists()
    .custom((value) => {
      if (!value) {
        throw new Error("Last date of leave is required");
      } else {
        const isValidDate = moment(value, DATE_FORMAT, true).isValid();
        if (isValidDate) {
          return true;
        }
        throw new Error("Date must be in DD/MM/YYYY format");
      }
    }),
  body("reason").exists().isString().withMessage("Reason for leave is missing"),
  validateErrors,
  fetchCredentials,
  async (req, res) => {
    try {
      const { employeeId, leaveType, fromDate, toDate, reason } = req.body;
      const employee = await Employee.findById(employeeId);
      if(!employee){
        return res.status(404).json({ error: "Employee not found" });
      }
      let isHR = true;
      let user = await Admin.findById(req.credential.id);
      if (!user) {
        if(employee._id.toString() !== req.credential.id){
          return res.status(403).json({ error: 'Access Denied' });
        }
        isHR = false;
      }

      // create the application if the user is verified
      const application = new LeaveApplication({
        employee: employee._id,
        leaveType,
        fromDate: moment(fromDate, DATE_FORMAT).toDate(),
        toDate: moment(toDate, DATE_FORMAT).toDate(),
        reason,
        document: req.file
          ? Buffer.from(req.file.buffer).toString("base64")
          : undefined,
        status: isHR ? 'Approved' : 'Pending',
      });
      await application.save();
      return res.status(202).json({ id: application._id });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
];

export const approveLeave = [
  fetchCredentials,
  upload.single("document"),
  async (req, res) => {
    try {
      const leaveId = req.params.id;
      if (!leaveId || !isValidObjectId(leaveId)) {
        return res.status(422).json({ error: "Invalid Application ID" });
      }
      const admin = await Admin.findById(req.credential.id);
      if (!admin) {
        return res.status(403).json({ error: "Access Denied" });
      }
      const leave = await LeaveApplication.findById(leaveId);
      if (!leave) {
        return res
          .status(404)
          .json({ error: "This application doesn't exist" });
      }
      if (leave.status !== "Pending") {
        return res
          .status(409)
          .json({ error: "Application is already accepted or rejected" });
      }
      leave.status = "Approved";
      if (req.file) {
        leave.document = Buffer.from(req.file.buffer).toString("base64");
      }
      await leave.save();
      // create notification for the employee
      const notification = new Notification({
        to: leave.employee,
        message: "Your application has been approved.",
        payload: {
          application: leave._id,
          employee: leave.employee,
        },
      });
      await notification.save();
      return res.status(200).json({ message: "Approved" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
];

export const rejectLeave = [
  fetchCredentials,
  async (req, res) => {
    try {
      const leaveId = req.params.id;
      if (!leaveId || !isValidObjectId(leaveId)) {
        return res.status(422).json({ error: "Invalid Application ID" });
      }
      const admin = await Admin.findById(req.credential.id);
      if (!admin) {
        return res.status(403).json({ error: "Access Denied" });
      }
      const leave = await LeaveApplication.findById(leaveId);
      if (!leave) {
        return res
          .status(404)
          .json({ error: "This application doesn't exist" });
      }
      if (leave.status !== "Pending") {
        return res
          .status(409)
          .json({ error: "Application is already accepted or rejected" });
      }
      leave.status = "Rejected";
      await leave.save();
      // create notification for the employee
      const notification = new Notification({
        to: leave.employee,
        message: "Your application has been rejected.",
        payload: {
          application: leave._id,
          employee: leave.employee,
        },
      });
      await notification.save();
      return res.status(200).json({ message: "Rejected" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
];

export const fetchAllApplications = [
  fetchCredentials,
  async (req, res) => {
    try {
      const { page, rowsPerPage } = req.params;
      const admin = await Admin.findById(req.credential.id);
      if (!admin) {
        // if not admin check whether he is employee or not
        const employee = await Employee.findById(req.credential.id);
        if (!employee) {
          return res.status(403).json({ error: "Access Denied" });
        }
        const applications = await LeaveApplication.find({
          employee: employee._id,
        })
          .sort({ date: -1 })
          .skip(rowsPerPage * page)
          .limit(rowsPerPage)
          .populate("employee", "employeeId name profilePic")
          .exec();
        const total = await LeaveApplication.countDocuments({
          employee: employee._id,
        });
        return res.status(200).json({ applications, total });
      }
      const applications = await LeaveApplication.find({})
        .sort({ date: -1 })
        .skip(rowsPerPage * page)
        .limit(rowsPerPage)
        .populate("employee", "employeeId name profilePic")
        .exec();
      const total = await LeaveApplication.countDocuments({});
      return res.status(200).json({ applications, total });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
];
