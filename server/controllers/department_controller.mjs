import { body } from "express-validator";
import fetchCredentials from "../middleware/fetchCredentials.mjs";
import validateErrors from "../middleware/validateErrors.mjs";
import Admin from "../db/models/Admin.mjs";
import Department from "../db/models/Department.mjs";
import Employee from "../db/models/Employee.mjs";
import { isValidObjectId } from "mongoose";

export const createDepartment = [
  // validation rules
  body("name").exists().isString().withMessage("Invalid Department Name"),
  body("description")
    .exists()
    .isString()
    .withMessage("Invalid Department Description"),
  body("openTime").custom((value) => {
    if (value) {
      if (/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(value)) {
        return true;
      }
    }
    throw new Error("Invalid Open Time");
  }),
  body("closeTime").custom((value) => {
    if (value) {
      if (/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(value)) {
        return true;
      }
    }
    throw new Error("Invalid Close Time");
  }),
  validateErrors,
  fetchCredentials,
  async (req, res) => {
    try {
      // verify admin
      const admin = await Admin.findById(req.credential.id);
      if (!admin) {
        return res.status(403).json({ error: "Access Denied" });
      }
      // extract the details from body
      const { name, description, openTime, closeTime } = req.body;
      // check if any department exists with same name
      const existingDepartment = await Department.findOne({ name });
      if (existingDepartment) {
        return res.status(409).json({ error: "Department Already Exists" });
      }

      const [openHour, openMin, openSec] = openTime.split(":");
      const [closeHour, closeMin, closeSec] = closeTime.split(":");

      const open = new Date();
      const close = new Date();
      open.setHours(+openHour);
      open.setMinutes(+openMin);
      open.setSeconds(+openSec);

      close.setHours(+closeHour);
      close.setMinutes(+closeMin);
      close.setSeconds(+closeSec);

      // create new department
      const newDepartment = new Department({
        name,
        description,
        open,
        close,
      });
      await newDepartment.save();
      return res.status(201).json({ id: newDepartment._id });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
];

export const fetchAllDepartments = [
  fetchCredentials,
  async (req, res) => {
    try {
      const admin = await Admin.findById(req.credential.id);
      if (!admin) {
        return res.status(403).json({ error: "Access Denied" });
      }
      const departments = await Department.find({}, "-__v");
      return res.status(200).json({ departments });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
];

export const updateDepartment = [
  // validation rules
  body("name").exists().isString().withMessage("Invalid Department Name"),
  body("description")
    .exists()
    .isString()
    .withMessage("Invalid Department Description"),
  body("openTime").custom((value) => {
    if (value) {
      if (/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(value)) {
        return true;
      }
    }
    throw new Error("Invalid Open Time");
  }),
  body("closeTime").custom((value) => {
    if (value) {
      if (/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(value)) {
        return true;
      }
    }
    throw new Error("Invalid Close Time");
  }),
  validateErrors,
  fetchCredentials,
  async (req, res) => {
    try {
      const deptId = req.params.id;
      // verify admin
      const admin = await Admin.findById(req.credential.id);
      if (!admin) {
        return res.status(403).json({ error: "Access Denied" });
      }
      // extract the details from body
      const { name, description, openTime, closeTime } = req.body;
      // check if any department exists with same name
      const existingDepartment = await Department.findById(deptId);
      if (!existingDepartment) {
        return res.status(404).json({ error: "Departmen not found" });
      }

      const [openHour, openMin, openSec] = openTime.split(":");
      const [closeHour, closeMin, closeSec] = closeTime.split(":");

      const open = new Date();
      const close = new Date();
      open.setHours(+openHour);
      open.setMinutes(+openMin);
      open.setSeconds(+openSec);

      close.setHours(+closeHour);
      close.setMinutes(+closeMin);
      close.setSeconds(+closeSec);

      // update the department
      existingDepartment.name = name;
      existingDepartment.description = description;
      existingDepartment.open = open;
      existingDepartment.close = close;
      await existingDepartment.save();
      return res.status(201).json({ message: "Department Updated" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
];

export const removeDepartment = [
  fetchCredentials,
  async (req, res) => {
    try {
      const deptId = req.params.id;
      if (!deptId || !isValidObjectId(deptId)) {
        return res.status(422).json({ error: "Invalid Department ID" });
      }
      const admin = await Admin.findById(req.credential.id);
      if (!admin) {
        return res.status(403).json({ error: "Access Denied" });
      }
      const removedDept = await Department.findOneAndDelete({ _id: deptId });
      if (!removedDept) {
        return res.status(404).json({ error: "No such department found!" });
      }
      await Employee.updateMany({ department: removedDept._id }, {$unset: {department: ""}});
      return res.status(200).json({ message: "Department deleted" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
];
