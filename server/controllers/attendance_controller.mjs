import fetchCredentials from "../middleware/fetchCredentials.mjs";
import multer from "multer";
import stream from "stream";
import streamToPromise from 'stream-to-promise';
import csv from "csv-parser";
import Employee from "../db/models/Employee.mjs";
import Admin from "../db/models/Admin.mjs";
import moment from "moment";
import { isValidObjectId } from "mongoose";
import LeaveApplication from "../db/models/LeaveApplication.mjs";

const upload = multer({ storage: multer.memoryStorage() });

const fTime = (date) => {
  const hour = date.getHours();

  const mins = date.getMinutes();

  const seconds = date.getSeconds();

  return `${hour}:${mins}:${seconds}`;
}

const maxTime = (time1, time2) => {
  const hour1 = time1.getHours();
  const hour2 = time1.getHours();

  const mins1 = time1.getMinutes();
  const mins2 = time2.getMinutes();

  const seconds1 = time1.getSeconds();
  const seconds2 = time2.getSeconds();

  const date1 = new Date();
  date1.setHours(hour1);
  date1.setMinutes(mins1);
  date1.setSeconds(seconds1);
  
  const date2 = new Date();
  date2.setHours(hour2);
  date2.setMinutes(mins2);
  date2.setSeconds(seconds2);

  return date1 > date2 ? date1 : date2;
}


const minTime = (time1, time2) => {
  const hour1 = time1.getHours();
  const hour2 = time1.getHours();

  const mins1 = time1.getMinutes();
  const mins2 = time2.getMinutes();

  const seconds1 = time1.getSeconds();
  const seconds2 = time2.getSeconds();

  const date1 = new Date();
  date1.setHours(hour1);
  date1.setMinutes(mins1);
  date1.setSeconds(seconds1);
  
  const date2 = new Date();
  date2.setHours(hour2);
  date2.setMinutes(mins2);
  date2.setSeconds(seconds2);

  return date1 < date2 ? date1 : date2;
}

export const uploadAttendance = [
  fetchCredentials,
  upload.single("attendance"),
  async (req, res) => {
    try {
      const admin = await Admin.findById(req.credential.id);
      if (!admin) {
        return res.status(403).json({ error: "Access Denied" });
      }
      const bufferStream = new stream.PassThrough();
      bufferStream.end(req.file.buffer);
      const promiseStream = streamToPromise(bufferStream.pipe(csv()));
      const rows = await promiseStream;

      for (const row of rows){
          try {
            // Find the employee in the database
            const date = moment(row["Date"], "YYYY-MM-DD");
            const employee = await Employee.findOne({
              employeeId: row["Employee ID"],
            })
            .populate("department")
            .exec();
              
            if (employee) {
              // Add the attendance record to the employee's attendance array
              const officeTime =
                employee.department.close - employee.department.open; // office  time in milliseconds
              let status;
              let daySalary;
              let entryExitTime = [];
              const oneDaySalary = employee.salary.base / date.daysInMonth();
              if (
                !row["Times"] ||
                row["Times"] === 0 ||
                row["Times"] === "" ||
                row["Times"] === "0"
              ) {
                // check if he has applied for leave
                const leave = await LeaveApplication.findOne({
                  employee: employee._id,
                  fromDate: { $lte: date },
                  toDate: { $gte: date },
                  status: "Approved",
                });
                if (leave) {
                  status = "Leave";
                  // check whether the leave is paid or unpaid
                  if (leave.leaveType === "Sick Leave") {
                    daySalary = oneDaySalary;
                  } else {
                    employee.salary.deductions =
                      employee.salary.deductions + oneDaySalary;
                    employee.salary.finalAmount =
                    employee.salary.finalAmount - oneDaySalary;
                    daySalary = 0;
                  }
                } else {
                  status = "Absent";
                  employee.salary.deductions =
                    employee.salary.deductions + oneDaySalary;
                    employee.salary.finalAmount =
                    employee.salary.finalAmount - oneDaySalary;
                  daySalary = 0;
                }
              } else {
                const timeOfEntryOrExit = Object.values(row).slice(5);
                if(timeOfEntryOrExit.length % 2 !== 0){
                  timeOfEntryOrExit.push(moment(employee.department.close).format('HH:mm:ss'));
                }
                else if(timeOfEntryOrExit.at(-1) === ''){
                  timeOfEntryOrExit[timeOfEntryOrExit.length - 1] = moment(employee.department.close).format('HH:mm:ss');
                }
                let employeesPresentTime = 0; // in milliseconds
                for (let i = 0; i < timeOfEntryOrExit.length; i = i + 2) {
                  // time when employee enters
                  const [entryHour, entryMin, entrySec] =
                    timeOfEntryOrExit[i].split(":");
                  const entryTime = new Date();
                  entryTime.setHours(+entryHour);
                  entryTime.setMinutes(+entryMin);
                  entryTime.setSeconds(+entrySec);

                  // time when employee exits
                  const [exitHour, exitMin, exitSec] =
                    timeOfEntryOrExit[i + 1].split(":");
                  const exitTime = new Date();
                  exitTime.setHours(+exitHour);
                  exitTime.setMinutes(+exitMin);
                  exitTime.setSeconds(+exitSec);

                  // total time when employee was in the office
                  employeesPresentTime += (minTime(exitTime, employee.department.close) - maxTime(entryTime, employee.department.open));
                  entryExitTime.push(entryTime);
                  entryExitTime.push(exitTime);
                }
                if (employeesPresentTime <= officeTime / 2) {
                  status = "Half Day";
                  employee.salary.deductions =
                  employee.salary.deductions + oneDaySalary / 2;
                  employee.salary.finalAmount =
                  employee.salary.finalAmount - oneDaySalary / 2;
                  daySalary = oneDaySalary / 2;
                } else {
                  status = "Present";
                  daySalary = oneDaySalary;
                }
              }
              employee.salary.lastUpdated = Date.now();
              employee.attendance.push({
                date,
                status,
                daySalary,
                entryExitTime,
              });
              // Save the updated employee document
              await employee.save();
            }
          } catch (error) {
            console.error(error);
          }
        }
        return res.status(200).json({message: "Attendance Uploaded"});
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
];

export const fetchAttendance = [
  fetchCredentials,
  async (req, res) => {
    try {
      const { id, page, rowsPerPage } = req.params;
      if (!id || !isValidObjectId(id)) {
        return res.status(422).json({ error: "Invalid Employee ID" });
      }
      const employee = await Employee.findById(id, "attendance");
      const total = employee.attendance.length;
      const attendance = employee.attendance.slice(page*rowsPerPage, page*rowsPerPage + rowsPerPage);
      if (!employee) {
        return res.status(403).json({ error: "No Employee Found" });
      }
      const admin = await Admin.findById(req.credential.id);
      if (!admin) {
        if (id !== req.credential.id) {
          return res.status(403).json({ error: "Access Denied" });
        }
      }
      return res.status(200).json({ attendance, total });
    } catch (error) {
      console.error(error);
    }
  },
];
