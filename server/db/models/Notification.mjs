import mongoose from "mongoose";

// Admin Schema
const notificationSchema = new mongoose.Schema({
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'employee',
  },
  pic: String,
  message: {
      type: String,
      required: true,
  },
  date: {
      type: Date,
      default: Date.now,
  },
  status: {
    type: String,
    enum: ["Unseen", "Seen"],
    default: "Unseen",
  },
  payload: {
      employee: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'employee',
      },
      application: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'leaveApplication',
      },
      department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'department',
      },
  }
});

const Notification = mongoose.model("notification", notificationSchema);
export default Notification;