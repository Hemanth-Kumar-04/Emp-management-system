import { body } from "express-validator";
import validateErrors from "../middleware/validateErrors.mjs";
import fetchCredentials from "../middleware/fetchCredentials.mjs";
import Admin from "../db/models/Admin.mjs";
import moment from "moment";
import { DATE_FORMAT } from "../constants/date_constants.mjs";
import { encryptPassword } from "../utils/encryption.mjs";

export const updateAdmin = [
  body("name.firstName")
    .optional()
    .isString()
    .isLength({ min: 1 })
    .withMessage("Invalid first name"),
  body("name.lastName")
    .optional()
    .isString()
    .isLength({ min: 1 })
    .withMessage("Invalid last name"),
  body("email").optional().isEmail().withMessage("Invalid Email"),
  body("phone").optional().isMobilePhone().withMessage("Invalid Mobile No."),
  body("whatsApp")
    .optional()
    .isMobilePhone()
    .withMessage("Invalid Whatsapp No."),
  body("dob").custom((value) => {
    if (value) {
      const isValidDate = moment(value, DATE_FORMAT, true).isValid();
      if (!isValidDate) {
        throw new Error("Date of birth must be in DD/MM/YYYY format");
      }
    }
    return true;
  }),
  body("password")
    .optional()
    .isLength({ min: 5 })
    .withMessage("Password must contain at least 5 characters"),
  body("gender")
    .optional()
    .isIn(["Male", "Female"])
    .withMessage("Gender can only be male or female"),
  validateErrors,
  fetchCredentials,
  async (req, res) => {
    try {
      const admin = await Admin.findById(req.credential.id);
      if (!admin) {
        return res.status(404).json({ error: "Admin details not found" });
      }
      if (req.body.password) {
        req.body.password = encryptPassword(req.body.password);
        if (!req.body.password) {
          return res.status(500).json({ error: "Something went wrong" });
        }
      }

      if (req.body.dob) {
        req.body.dob = moment(req.body.dob, DATE_FORMAT).toDate();
      }

      try {
        Object.keys(req.body).forEach(async (key) => {
          if (admin[key]) {
            if (key === "email" || key === "phone" || key === "whatsApp") {
              const admin = await Admin.findOne({
                $or: [
                  { email: req.body[key] },
                  { phone: req.body[key] },
                  { whatsApp: req.body[key] },
                ],
              });
              if (admin) {
                throw new Error("Credential is already registered");
              }
            }
            admin[key] = req.body[key];
          }
        });
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }

      await admin.save();
      return res.status(200).json({ message: "Updated" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
];
