import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { isValidObjectId } from "mongoose";

dotenv.config();
const jwt_secret = process.env.JWT_SECRET;

const fetchCredentials = async (req, res, next) => {
  try {
    // get the authentication token from header
    const token = req.header('token');
    if (!token) {
      return res.status(401).json({ error: "Invalid Credentials" });
    }
    // employee's/admin's credentials
    req.credential = jwt.verify(token, jwt_secret);
    if (!isValidObjectId(req.credential.id)) {
      return res.status(401).json({ error: "Invalid Credentials" });
    }
    next();
  } catch {
    return res.status(400).json({ error: "Something went wrong!" });
  }
};

export default fetchCredentials;
