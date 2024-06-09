import mongoose from "mongoose";

// Leave Application Schema
const leaveApplicationSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "employee",
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  leaveType: {
    type: String,
    required: true,
    enum: ["Sick Leave", "Personal Leave", "Others"],
  },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  reason: { type: String, required: true },
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending",
  },
  document: String,
});

const LeaveApplication = mongoose.model(
  "leaveApplication",
  leaveApplicationSchema
);
export default LeaveApplication;
