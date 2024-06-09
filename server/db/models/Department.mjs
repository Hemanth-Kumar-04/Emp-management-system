import mongoose from "mongoose";

// Department Schema
const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  open: Date,
  close: Date,
});

const Department = mongoose.model("department", departmentSchema);
export default Department;
