import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { body } from "express-validator";
import Employee from "../db/models/Employee.mjs";
import Admin from "../db/models/Admin.mjs";
import validateErrors from "../middleware/validateErrors.mjs";
import { encryptPassword } from "../utils/encryption.mjs";
import moment from "moment";
import { DATE_FORMAT } from "../constants/date_constants.mjs";
import fetchCredentials from "../middleware/fetchCredentials.mjs";

dotenv.config();
const jwt_secret = process.env.JWT_SECRET;

// export const changePsswd = [
//   fetchCredentials,
//   async (req, res) => {
//     const password = encryptPassword(req.body.password);
//     if (!password) {
//       return res.status(500).json({ error: "Something Went Wrong!" });
//     }
//     const admin = await Admin.findById(req.credential.id);
//     admin.password = password;
//     await admin.save();
//     return res.sendStatus(204);
//   },
// ];

// export const adminReg = [
//   async (req, res) => {
//     const { name, email, phone, whatsApp, dob, gender, role } = req.body;
//     // employees' default password will be his/her date of birth in dd/mm/yyyy format
//     const encryptedPassword = encryptPassword(dob);
//     if (!encryptedPassword) {
//       return res.status(500).json({ error: "Something Went Wrong!" });
//     }
//     // create a new employee and save
//     const newAdmin = new Admin({
//       name,
//       email,
//       phone,
//       whatsApp,
//       dob: moment(dob, DATE_FORMAT).toDate(),
//       password: encryptedPassword,
//       gender,
//       role,
//     });

//     await newAdmin.save();
//     return res.status(201).json({ id: newAdmin._id });
//   },
// ];

// controller for admin login
export const login = [
  // validation rules
  body("email").exists().isEmail().withMessage("Valid email must be provided"),
  body("password").exists().withMessage("Password must be provided"),
  validateErrors,
  async (req, res) => {
    try {
      let user = await Admin.findOne({ email: req.body.email });
      // check if admin doesn't exist
      if (!user) {
        user = await Employee.findOne({ email: req.body.email });
        if (!user) {
          return res
            .status(404)
            .json({ error: "Employee/Admin details not found!" });
        }
      }
      // match the employee/admin's password
      const match = bcrypt.compareSync(req.body.password, user.password);
      if (!match) {
        return res.status(401).json({ error: "Invalid Credentials!" });
      }
      // prepare the payload for token
      const payload = {
        id: user._id,
        role: user.role,
      };
      const token = jwt.sign(payload, jwt_secret);
      return res.status(200).json({ id: user._id, token });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
];
