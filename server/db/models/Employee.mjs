import mongoose from "mongoose";

// Employee Schema
const employeeSchema = new mongoose.Schema({
  profilePic: String,
  employeeId: { type: String, required: true, unique: true },
  name: {
    firstName: { type: String, required: true },
    lastName: { type: String },
  },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  whatsApp: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  dob: {
    type: Date,
    required: true,
  },
  address: {
    local: String,
    city: String,
    state: String,
    pincode: Number,
  },
  commAddress: {
    local: String,
    city: String,
    state: String,
    pincode: Number,
  },
  gender: {
    type: String,
    enum: ["Male", "Female"],
  },
  role: { type: String, required: true },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "department",
  },

  qatarDocs: {
    id: String,
    file: String,
    expiryDate: Date,
  },

  passportDocs: {
    id: String,
    file: String,
    expiryDate: Date,
  },

  documents: [
    {
      documentType: String,
      file: String,
      expiryDate: Date,
    },
  ],

  salary: {
    base: Number,
    deductions: {
      type: Number,
      default: 0,
    },
    finalAmount: {
      type: Number,
      default: 0,
    },
    hike: Number,
    lastUpdated: Date,
  },
  attendance: [
    {
      date: Date,
      status: {
        type: String,
        enum: ["Present", "Absent", "Leave", "Half Day"],
      },
      daySalary: Number,
      entryExitTime: [Date],
    },
  ],
});

const Employee = mongoose.model("employee", employeeSchema);
export default Employee;
