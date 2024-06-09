import Admin from "../db/models/Admin.mjs";
import Employee from "../db/models/Employee.mjs";
import Department from "../db/models/Department.mjs";
import LeaveApplication from "../db/models/LeaveApplication.mjs";
import fetchCredentials from "../middleware/fetchCredentials.mjs";

// Fetch the total number of expiring documents within 3 days
async function fetchTotalExpiringDocuments() {
  try {
    const currentDate = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(currentDate.getDate() + 3);

    const expiringDocumentsCount = await Employee.aggregate([
      {
        $match: {
          $or: [
            {
              "qatarDocs.expiryDate": {
                $lt: threeDaysFromNow,
                $gte: currentDate,
              },
            },
            {
              "passportDocs.expiryDate": {
                $lt: threeDaysFromNow,
                $gte: currentDate,
              },
            },
          ],
        },
      },
      {
        $group: {
          _id: null,
          totalExpiringDocuments: {
            $sum: {
              $add: [
                {
                  $cond: [
                    {
                      $and: [
                        { $lt: ["$qatarDocs.expiryDate", threeDaysFromNow] },
                        { $gte: ["$qatarDocs.expiryDate", currentDate] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
                {
                  $cond: [
                    {
                      $and: [
                        { $lt: ["$passportDocs.expiryDate", threeDaysFromNow] },
                        { $gte: ["$passportDocs.expiryDate", currentDate] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              ],
            },
          },
        },
      },
    ]);
    if (expiringDocumentsCount.length > 0) {
      return expiringDocumentsCount[0].totalExpiringDocuments;
    } else {
      return 0;
    }
  } catch (error) {
    console.error("Error fetching expiring documents:", error);
    return 0;
  }
}

async function getAbsentLeaveCountByDepartmentThisYearMonthWise() {
  try {
    const defaultDataToSend = [
      {
        dapartmentName: "NA",
        attendance: Array(12).fill(0),
      },
      {
        dapartmentName: "NA",
        attendance: Array(12).fill(0),
      },
      {
        dapartmentName: "NA",
        attendance: Array(12).fill(0),
      },
    ];

    const today = new Date();
    const thisYear = today.getFullYear();

    const results = await Employee.aggregate([
      {
        $unwind: "$attendance", // Unwind the attendance array
      },
      {
        $match: {
          "attendance.status": { $in: ["Absent", "Leave"] }, // Filter by status
          "attendance.date": {
            $gte: new Date(thisYear, 0, 1), // Start of this year
            $lt: today, // End of today
          },
        },
      },
      {
        $group: {
          _id: {
            department: "$department",
            month: { $month: "$attendance.date" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "departments",
          localField: "_id.department",
          foreignField: "_id",
          as: "departmentDetails",
        },
      },
      {
        $project: {
          departmentId: "$_id.department",
          departmentName: { $arrayElemAt: ["$departmentDetails.name", 0] },
          month: "$_id.month",
          count: 1,
        },
      },
      {
        $sort: { count: -1 }, // Sort by month
      },
      {
        $limit: 3,
      },
    ]).exec();

    // Create an array of department objects
    const departmentData = [];
    const departmentMap = new Map(); // To group counts by department

    results.forEach((dept) => {
      const { departmentId, departmentName, month, count } = dept;
      if (!departmentMap.has(departmentId)) {
        departmentMap.set(departmentId, {
          departmentId,
          departmentName,
          attendance: Array(12).fill(0), // Initialize an array for 12 months
        });
      }
      departmentMap.get(departmentId).attendance[month - 1] = count;
    });

    // Convert the map values to an array
    departmentMap.forEach((dept) => {
      departmentData.push(dept);
    });

    if (departmentData.length === 0) {
      return defaultDataToSend;
    }

    return departmentData;
  } catch (err) {
    console.error("Error fetching data:", err);
    return defaultDataToSend;
  }
}

async function fetchLeavesByType() {
  try {
    const defaultDataToSend = [
      { _id: "Sick Leave", totalLeaves: 0 },
      { _id: "Personal Leave", totalLeaves: 0 },
      { _id: "Others", totalLeaves: 0 },
    ];

    const currentMonth = new Date().getMonth() + 1; // Get the current month (1-12)
    const pipeline = [
      {
        $match: {
          fromDate: {
            $gte: new Date(new Date().getFullYear(), currentMonth - 1, 1), // Start of current month
            $lt: new Date(new Date().getFullYear(), currentMonth, 1), // Start of next month
          },
          status: "Approved",
        },
      },
      {
        $group: {
          _id: "$leaveType",
          totalLeaves: { $sum: 1 },
        },
      },
    ];

    const result = await LeaveApplication.aggregate(pipeline);
    if (result.length === 0) {
      return defaultDataToSend;
    }
    return result;
  } catch (error) {
    console.error(error);
    return defaultDataToSend;
  }
}

export const fetchAdminSummary = [
  fetchCredentials,
  async (req, res) => {
    try {
      const admin = await Admin.findById(req.credential.id);
      if (!admin) {
        return res.status(403).json({ error: "Access Denied" });
      }
      const totalEmployees = await Employee.countDocuments({});
      const totalDepartments = await Department.countDocuments({});
      const pendingApplications = await LeaveApplication.countDocuments({
        status: "Pending",
      });
      const expiringDocuments = await fetchTotalExpiringDocuments();
      const attendanceSummary =
        await getAbsentLeaveCountByDepartmentThisYearMonthWise();

      const leaveSummary = await fetchLeavesByType();

      return res.status(200).json({
        totalEmployees,
        totalDepartments,
        pendingApplications,
        expiringDocuments,
        attendanceSummary,
        leaveSummary,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
];
