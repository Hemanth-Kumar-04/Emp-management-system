import mongoose from "mongoose";

// Admin Schema
const adminSchema = new mongoose.Schema({
  name: {
    firstName: { type: String, required: true },
    lastName: { type: String },
  },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  whatsApp: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  dob: { type: Date, required: true },
  gender: {type: String, enum: ["Male", "Female"]},
  role: { type: String, default: "HR" },
});

const Admin = mongoose.model("admin", adminSchema);
export default Admin;