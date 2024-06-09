import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import auth_router from "./routes/auth_router.mjs";
import department_router from "./routes/department_router.mjs";
import employee_router from "./routes/employee_router.mjs";
import application_router from "./routes/application_router.mjs";
import notification_router from "./routes/notification_router.mjs";
import attendance_router from "./routes/attendance_router.mjs";
import admin_router from "./routes/admin_router.mjs";
import summary_router from "./routes/summary_router.mjs";
import { scheduleSalaryAndNotificationReset } from "./utils/scheduleTask.mjs";
import { scheduleSalaryHike } from "./utils/scheduleTask.mjs";

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const app = express();

dotenv.config();

const port = process.env.PORT || 3000;
const db_url = process.env.LOCAL_DB_URL || process.env.DB_URL;

// Cors object for configuration setup
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' ? process.env.PRODUCTION_URL : 'http://localhost:3030',
  credentials: true,
  optionSuccessStatus: 200,
};
// Configuring cors for every request from localhost:3030
app.use(cors(corsOptions));

// Get the current directory
const __dirname = dirname(fileURLToPath(import.meta.url));

// Serve static files from the React app build directory
app.use(express.static(`${__dirname}/dist`));

// Parse the body content from incoming requests
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: false }));

// Available Routes
app.use("/api/v1/auth", auth_router); // for employee/HR authentication
app.use("/api/v1/admin", admin_router); // for employee/HR authentication
app.use("/api/v1/departments", department_router); // for handling departments
app.use("/api/v1/employees", employee_router); // for handling employees
app.use("/api/v1/applications", application_router); // for handling leave applications
app.use("/api/v1/notifications", notification_router); // for handling leave applications
app.use("/api/v1/attendance", attendance_router); // for handling attendance of employees
app.use("/api/v1/summary", summary_router); // for handling summary


// catch all handler
app.get('*', (req, res) => {
  res.sendFile(`${__dirname}/dist/index.html`);
});

console.log("Connecting to database...");
mongoose.connect(db_url).then(() => {
    console.log("Connected to database.");
    app.listen(port, () => {
      console.log(`Server is running on port:${port}`);
      scheduleSalaryHike();
      scheduleSalaryAndNotificationReset();
    });
}).catch(error => {
    console.log("Error while connecting to database.");
    console.log(error);
});