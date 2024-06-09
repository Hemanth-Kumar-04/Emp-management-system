import Employee from "../db/models/Employee.mjs";
import LeaveApplication from "../db/models/LeaveApplication.mjs";
import Notifications from "../db/models/LeaveApplication.mjs";
import { encryptPassword } from "../utils/encryption.mjs";
import { isValidObjectId } from "mongoose";

import { body } from "express-validator";
import multer from "multer";
import fetchCredentials from "../middleware/fetchCredentials.mjs";
import validateErrors from "../middleware/validateErrors.mjs";
import Admin from "../db/models/Admin.mjs";
import Department from "../db/models/Department.mjs";
import moment from "moment";
import { FILE_SIZE, FILE_FORMAT } from "../constants/file_constants.mjs";
import { DATE_FORMAT } from "../constants/date_constants.mjs";
import { unchangeableFields } from "../db/constraints.mjs";
import { uniqueFields } from "../db/constraints.mjs";
import { scheduleNotification } from "../utils/scheduleTask.mjs";
import path from "path";
import { cancelNotification } from "../utils/scheduleTask.mjs";

// document file type validation
const upload = multer({
  limits: {
    fileSize: FILE_SIZE, // limit file size to 20MB
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

export const createEmployee = [
  upload.fields([
    { name: "profilePicture", maxCount: 1 },
    { name: "qatarDoc", maxCount: 1 },
    { name: "passportDoc", maxCount: 1 },
  ]),
  // validation rules
  body("employeeId").exists().withMessage("EmployeeId is missing"),
  body("firstName")
    .exists()
    .isString()
    .withMessage("Employee first name is missing"),
  body("lastName")
    .exists()
    .isString()
    .withMessage("Employee last name is missing"),
  body("email").exists().isEmail().withMessage("Invalid Email"),
  body("phone").exists().isMobilePhone().withMessage("Invalid Phone No."),
  body("whatsApp").exists().isMobilePhone().withMessage("Invalid Whatsapp No."),
  body("dob").custom((value) => {
    if (!value) {
      throw new Error("Date of birth required");
    } else {
      const isValidDate = moment(value, DATE_FORMAT, true).isValid();
      if (isValidDate) {
        return true;
      }
      throw new Error("Date of birth must be in DD/MM/YYYY format");
    }
  }),
  body("gender")
    .exists()
    .isIn(["Male", "Female"])
    .withMessage("Gender field can only be Male or Female"),
  body("role").exists().withMessage("Employee Role is missing"),
  body("salary").exists().isNumeric().withMessage("Employee Salary is missing"),
  body("hike")
    .exists()
    .isNumeric()
    .withMessage("Employee salary's hike is required"),
  body("departmentId")
    .exists()
    .isString()
    .custom((value) => {
      if (isValidObjectId(value)) return true;
      throw new Error("Invalid Department ID");
    }),
  body("qatarExpiryDate").custom((value) => {
    if (value) {
      const isValidDate = moment(value, DATE_FORMAT, true).isValid();
      if (isValidDate) {
        return true;
      }
    }
    throw new Error("Qatar Expiry date must be in DD/MM/YYYY format");
  }),
  body("qatarID")
    .exists()
    .isString()
    .isLength({ min: 1 })
    .withMessage("Qatar ID is required"),
  body("passportExpiryDate").custom((value) => {
    if (value) {
      const isValidDate = moment(value, DATE_FORMAT, true).isValid();
      if (isValidDate) {
        return true;
      }
    }
    throw new Error("Passport Expiry date must be in DD/MM/YYYY format");
  }),
  body("passportID")
    .exists()
    .isString()
    .isLength({ min: 1 })
    .withMessage("Passport ID is required"),
  validateErrors,
  fetchCredentials,
  async (req, res) => {
    try {
      // verify admin
      const admin = await Admin.findById(req.credential.id);
      if (!admin) {
        return res.status(403).json({ error: "Access Denied" });
      }
      // extract data from body
      const {
        employeeId,
        firstName,
        lastName,
        email,
        phone,
        whatsApp,
        dob,
        gender,
        local,
        pincode,
        city,
        state,
        commLocal,
        commPincode,
        commCity,
        commState,
        role,
        salary,
        hike,
        departmentId,
        qatarID,
        qatarExpiryDate,
        passportID,
        passportExpiryDate,
      } = req.body;
      // check if employeeId or email already exists
      const employeeWithProvidedEmailOrPhone = await Employee.findOne({
        $or: [{ email }, { phone }, { whatsApp }],
      });
      if (employeeWithProvidedEmailOrPhone) {
        return res.status(409).json({
          error: "Email ID, Phone No. or WhatsApp No. is already registered",
        });
      }
      const employeeWithProvidedEmployeeId = await Employee.findOne({
        employeeId,
      });
      if (employeeWithProvidedEmployeeId) {
        return res
          .status(409)
          .json({ error: `Employee with ID ${employeeId} already exists` });
      }
      // employees' default password will be his/her date of birth in dd/mm/yyyy format
      const encryptedPassword = encryptPassword(dob);
      if (!encryptedPassword) {
        return res.status(500).json({ error: "Something Went Wrong!" });
      }

      // check if department exists
      const department = await Department.findById(departmentId, "_id");
      if (!department) {
        return res.status(404).json({ error: "No department found!" });
      }

      // create a new employee and save
      const newEmployee = new Employee({
        employeeId,
        email,
        name: {
          firstName,
          lastName,
        },
        phone,
        whatsApp,
        dob: moment(dob, DATE_FORMAT).toDate(),
        address: {
          local,
          city,
          state,
          pincode,
        },
        commAddress: {
          local: commLocal,
          city: commCity,
          state: commState,
          pincode: commPincode,
        },
        password: encryptedPassword,
        gender,
        role,
        salary: {
          base: salary,
          finalAmount: salary,
          hike,
        },
        department: department._id,
        attendance: [],
      });

      let profilePic;
      if (req.files) {
        // profile pic
        const profilePicture = req.files.profilePicture;
        if (profilePicture && profilePicture.length > 0) {
          profilePic = Buffer.from(profilePicture[0].buffer).toString("base64");
        }
        newEmployee.profilePic = profilePic;

        // legal documents
        const qatarImg = req.files.qatarDoc;
        const passportImg = req.files.passportDoc;
        if (
          !qatarImg ||
          !passportImg ||
          qatarImg.length === 0 ||
          passportImg.length === 0
        ) {
          return res
            .status(404)
            .json({ error: "Qatar/Passport document not found" });
        }
        newEmployee.qatarDocs = {
          id: qatarID,
          file: Buffer.from(qatarImg[0].buffer).toString("base64"),
          expiryDate: moment(qatarExpiryDate, DATE_FORMAT).toDate(),
        };
        newEmployee.passportDocs = {
          id: passportID,
          file: Buffer.from(passportImg[0].buffer).toString("base64"),
          expiryDate: moment(passportExpiryDate, DATE_FORMAT).toDate(),
        };
      }
      await newEmployee.save();
      return res.status(201).json({ id: newEmployee._id });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
];

export const fetchAllEmployees = [
  fetchCredentials,
  async (req, res) => {
    try {
      // verify admin
      const admin = await Admin.findById(req.credential.id);
      if (!admin) {
        return res.status(403).json({ error: "Access Denied" });
      }
      const employees = await Employee.find(
        {},
        "employeeId profilePic name role salary"
      )
        .populate("department", "name")
        .exec();
      return res.status(200).json({ employees });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
];

export const fetchEmployeeById = [
  fetchCredentials,
  async (req, res) => {
    // check if detail is requested by employee
    const employeeId = req.params.id;
    if (!isValidObjectId(employeeId)) {
      return res.status(422).json({ error: "Invalid Employee ID" });
    }
    let user = await Admin.findById(employeeId, "-password -__v");
    if (!user) {
      user = await Employee.findById(employeeId, "-password -attendance -__v")
        .populate("department", "name")
        .exec();
      if (!user) {
        return res.status(404).json({ error: "No employee found!" });
      }
    }

    const currentMonth = new Date().getMonth() + 1; // Get the current month (1-12)
    const pipeline = [
      {
        $match: {
          fromDate: {
            $gte: new Date(new Date().getFullYear(), currentMonth - 1, 1), // Start of current month
            $lt: new Date(new Date().getFullYear(), currentMonth, 1), // Start of next month
          },
          employee: user._id,
        },
      },
      {
        $group: {
          _id: "$status",
          totalLeaves: { $sum: 1 },
        },
      },
    ];

    const leaveSummary = await LeaveApplication.aggregate(pipeline);

    const attendanceSummary = await Employee.aggregate([
      {
        $match: {
          _id: user._id,
        },
      },
      {
        $unwind: "$attendance", // Unwind the attendance array
      },
      {
        $match: {
          "attendance.date": {
            $gte: new Date(new Date().getFullYear(), currentMonth - 1, 1), // Start of current month
            $lt: new Date(new Date().getFullYear(), currentMonth, 1), // Start of next month
          },
        },
      },
      {
        $group: {
          _id: "$attendance.status",
          total: { $sum: 1 },
        },
      },
    ]);
    // check if employee is requesting his own deatils
    if (employeeId === req.credential.id) {
      return res.status(200).json({ user, leaveSummary, attendanceSummary });
    }
    // check if admin is requesting details
    const admin = await Admin.findById(req.credential.id);
    if (!admin) {
      return res.status(403).json({ error: "Access Denied" });
    }
    return res.status(200).json({ user, leaveSummary, attendanceSummary });
  },
];

export const updateEmployee = [
  upload.fields([
    { name: "profilePicture", maxCount: 1 },
    { name: "qatarDoc", maxCount: 1 },
    { name: "passportDoc", maxCount: 1 },
  ]),
  // validation rules
  body("update.name.firstname")
    .optional()
    .isString()
    .withMessage("Invalid first name"),
  body("update.name.lastname")
    .optional()
    .isString()
    .withMessage("Invalid last name"),
  body("update.email").optional().isEmail().withMessage("Invalid Email"),
  body("update.salary")
    .optional()
    .isNumeric()
    .withMessage("Employee Salary is missing"),
  body("update.gender")
    .optional()
    .isIn(["Male", "Female"])
    .withMessage("Gender can only be Male or Female"),
  body("update.department")
    .optional()
    .isString()
    .custom((value) => {
      if (isValidObjectId(value)) return true;
      throw new Error("Invalid Department ID");
    }),

  body("update.qatarExpiryDate").custom((value) => {
    if (value) {
      const isValidDate = moment(value, DATE_FORMAT, true).isValid();
      if (isValidDate) {
        return true;
      }
      throw new Error("Qatar Expiry date must be in DD/MM/YYYY format");
    }
    return true;
  }),
  body("update.qatarId")
    .optional()
    .isString()
    .isLength({ min: 1 })
    .withMessage("Invalid Qatar ID"),
  body("update.passportExpiryDate").custom((value) => {
    if (value) {
      const isValidDate = moment(value, DATE_FORMAT, true).isValid();
      if (isValidDate) {
        return true;
      }
      throw new Error("Passport Expiry date must be in DD/MM/YYYY format");
    }
    return true;
  }),
  body("update.passportId")
    .optional()
    .isString()
    .isLength({ min: 1 })
    .withMessage("Invalid Passport ID"),
  validateErrors,
  fetchCredentials,
  async (req, res) => {
    const update = JSON.parse(req.body.update);
    if (!update) {
      return res.status(401).json({ error: "Update object not provided" });
    }
    const employeeId = req.params.id;
    // check if object id provided is valid mongodb object id
    if (!isValidObjectId(employeeId)) {
      return res.status(422).json({ error: "Invalid Employee ID" });
    }
    const admin = await Admin.findById(req.credential.id);
    if (!admin) {
      return res.status(403).json({ error: "Access Denied" });
    }
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found!" });
    }
    try {
      // update the corresponding value in database if exists
      for (const key of Object.keys(update)) {
        if (employee[key] || key === 'department') {
          // unchangeable fields like employeeId, dob etc. are not allowed to change
          if (unchangeableFields.includes(key)) {
            throw new Error(`You can't change employee's ${key}`);
          }
          // check for unique fields like email, phone, whatsApp etc.
          if (uniqueFields.includes(key)) {
            const employee = await Employee.findOne({
              $or: [{ [key]: update[key] }],
            });
            if (employee) {
              throw new Error(`${key} is already registered!`);
            }
          }
          if (key === "password") {
            update[key] = encryptPassword(update[key]);
          } else if (key === "salary") {
            update[key] = {
              ...employee[key],
              base: update[key],
            };
          } else if (key === "hike") {
            update[key] = {
              ...employee[key],
              hike: update[key],
            };
          }
          employee[key] = update[key];
        }
      }
    } catch (error) {
      return res.status(403).json({ error: error.message });
    }

    // update if address exists
    const {
      local,
      city,
      state,
      pincode,
      commLocal,
      commCity,
      commState,
      commPincode,
    } = update;
    if (local || city || state || pincode) {
      employee.address = {
        local: local || employee.address.local,
        city: city || employee.address.city,
        state: state || employee.address.state,
        pincode: pincode || employee.address.pincode,
      };
    }
    if (commLocal || commCity || commState || commPincode) {
      employee.commAddress = {
        local: commLocal || employee.commAddress.local,
        city: commCity || employee.commAddress.commCity,
        state: commState || employee.commAddress.commState,
        pincode: commPincode || employee.commAddress.commPincode,
      };
    }
    // update documents separately
    if (req.files) {
      // profile pic
      const profilePicture = req.files.profilePicture;
      if (profilePicture) {
        employee.profilePic = Buffer.from(profilePicture[0].buffer).toString(
          "base64"
        );
      }
      // legal documents
      const qatarImg = req.files.qatarDoc;
      const passportImg = req.files.passportDoc;
      const prevQatarId = employee.qatarDocs.id;
      const prevPassportId = employee.passportDocs.id;
      if (qatarImg && qatarImg.length > 0) {
        employee.qatarDocs = {
          ...employee.qatarDocs,
          file: Buffer.from(qatarImg[0].buffer).toString("base64"),
        };
      }
      if (passportImg && passportImg.length > 0) {
        employee.passportDocs = {
          ...employee.passportDocs,
          file: Buffer.from(passportImg[0].buffer).toString("base64"),
        };
      }
      if (update.qatarExpiryDate) {
        employee.qatarDocs = {
          ...employee.qatarDocs,
          expiryDate: moment(update.qatarExpiryDate, DATE_FORMAT).toDate(),
        };
        cancelNotification(prevQatarId);
        scheduleNotification({
          id: update.qatarId,
          message: `${employee.name.firstName} ${
            employee.name.lastName
          }'s qatar document has expired. Kindly inform ${
            employee.gender === "Male" ? "him" : "her"
          }`,
          date: moment(update.qatarExpiryDate, DATE_FORMAT).toDate(),
          employee: employee._id,
        });
      }
      if (update.passportExpiryDate) {
        employee.passportDocs = {
          ...employee.passportDocs,
          expiryDate: moment(update.passportExpiryDate, DATE_FORMAT).toDate(),
        };
        cancelNotification(prevPassportId);
        scheduleNotification({
          id: update.passportId,
          message: `${employee.name.firstName} ${
            employee.name.lastName
          }'s passport document has expired. Kindly inform ${
            employee.gender === "Male" ? "him" : "her"
          }`,
          date: moment(update.passportExpiryDate, DATE_FORMAT).toDate(),
          employee: employee._id,
        });
      }
      if (update.qatarId) {
        employee.qatarDocs = {
          ...employee.qatarDocs,
          id: update.qatarId,
        };
      }
      if (update.passportId) {
        employee.passportDocs = {
          ...employee.passportDocs,
          id: update.passportId,
        };
      }
    }
    await employee.save();
    return res.status(200).json({ mssg: "Success" });
  },
];

export const removeEmployee = [
  fetchCredentials,
  async (req, res) => {
    try {
      const employeeId = req.params.id;
      if (!isValidObjectId(employeeId)) {
        return res.status(422).json({ error: "Invalid Employee ID" });
      }
      // check if admin has requested
      const admin = await Admin.findById(req.credential.id);
      if (!admin) {
        return res.status(403).json({ error: "Access Denied" });
      }
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }
      await LeaveApplication.deleteMany({ employee: employeeId });
      await Notifications.deleteMany({
        $or: [{ to: employeeId }, { "payload.employee": employeeId }],
      });
      // cancel all scheduled notifications
      employee.documents.forEach((doc) => {
        cancelNotification(`${doc.documentType}^${employeeId}`);
      });
      const removedEmployee = await Employee.findOneAndDelete({
        _id: employeeId,
      });
      if (!removedEmployee) {
        return res.status(404).json({ error: "No such employee exists" });
      }
      return res.sendStatus(204);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
];
