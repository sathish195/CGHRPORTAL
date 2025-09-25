// const cron = require("node-cron");
// const mongoFunctions = require("./mongoFunctions");
// const { alertDev } = require("./telegram");
// //
// const functions = require("./functions");
// const { checkPreferences } = require("joi");
// const { calculate_working_minutes } = require("./stats");
// const moment = require("moment-timezone");
// const getCurrentDayRange = () => {
//   const now = moment().tz("Asia/Kolkata");
//   return {
//     start: now.startOf("day").toDate(),
//     end: now.endOf("day").toDate(),
//   };
// };

// // const getCurrentDayRange = () => {
// //   const now = new Date();
// //   return {
// //     start: new Date(now.setHours(0, 0, 0, 0)),
// //     end: new Date(now.setHours(23, 59, 59, 999)),
// //   };
// // };

// const createAttendanceRecords = async (employees, status = "") => {
//   const activeEmployees = employees.filter(
//     (employee) =>
//       employee.work_info.employee_status.toLowerCase() !== "disable" &&
//       employee.work_info.employee_status.toLowerCase() !== "terminated"
//   );
//   const absenceUpdates = activeEmployees.map((employee) => {
//     const newRecord = {
//       organisation_id: employee.organisation_id,
//       attendance_id: functions.get_random_string("A", 3, true) + Date.now(),
//       employee_id: employee.employee_id,
//       employee_name: `${employee.basic_info.first_name} ${employee.basic_info.last_name}`,
//       attendance_status: status,
//       // status:stat
//     };
//     return mongoFunctions.create_new_record("ATTENDANCE", newRecord);
//   });

//   await Promise.all(absenceUpdates);
//   alertDev(
//     `Attendance records created for all employees with status '${status}'.`
//   );
// };
// const createHolidayRecords = async (
//   employees,
//   attendance_status = "",
//   status
// ) => {
//   const activeEmployees = employees.filter(
//     (employee) =>
//       employee.work_info.employee_status.toLowerCase() !== "disable" &&
//       employee.work_info.employee_status.toLowerCase() !== "terminated"
//   );
//   const absenceUpdates = activeEmployees.map((employee) => {
//     const newRecord = {
//       organisation_id: employee.organisation_id,
//       attendance_id: functions.get_random_string("A", 3, true) + Date.now(),
//       employee_id: employee.employee_id,
//       employee_name: `${employee.basic_info.first_name} ${employee.basic_info.last_name}`,
//       attendance_status: attendance_status,
//       status: status,
//     };
//     return mongoFunctions.create_new_record("ATTENDANCE", newRecord);
//   });

//   await Promise.all(absenceUpdates);
//   alertDev(
//     `Attendance records created for all employees with status '${status}'.`
//   );
// };

// const updateAttendanceStatus = async () => {
//   const { start, end } = getCurrentDayRange();
//   const attendanceRecord = await mongoFunctions.find("ATTENDANCE", {
//     createdAt: { $gte: start, $lte: end },
//   });
//   const employees = await mongoFunctions.find("EMPLOYEE");
//   const activeEmployees = employees.filter(
//     (employee) =>
//       employee.work_info.employee_status.toLowerCase() !== "disable" &&
//       employee.work_info.employee_status.toLowerCase() !== "terminated"
//   );

//   const employeeIdsInAttendance = attendanceRecord.map(
//     (record) => record.employee_id
//   );
//   const missingRecords = activeEmployees.filter(
//     (employee) => !employeeIdsInAttendance.includes(employee.employee_id)
//   );

//   if (attendanceRecord.length === 0 || missingRecords.length > 0) {
//     const recordsToCreate =
//       attendanceRecord.length === 0 ? activeEmployees : missingRecords;
//     await createAttendanceRecords(
//       recordsToCreate,
//       attendanceRecord.length === 0 ? "" : ""
//     );
//   }
// };

// const updateStatusInWeekends = async () => {
//   const { start, end } = getCurrentDayRange();
//   const attendanceRecord = await mongoFunctions.find("ATTENDANCE", {
//     createdAt: { $gte: start, $lte: end },
//   });
//   const employees = await mongoFunctions.find("EMPLOYEE");
//   const activeEmployees = employees.filter(
//     (employee) =>
//       employee.work_info.employee_status.toLowerCase() !== "disable" &&
//       employee.work_info.employee_status.toLowerCase() !== "terminated"
//   );

//   if (attendanceRecord.length === 0) {
//     await createAttendanceRecords(activeEmployees, "weekend");
//   } else {
//     const employeeIdsInAttendance = attendanceRecord.map(
//       (record) => record.employee_id
//     );
//     const missingRecords = activeEmployees.filter(
//       (employee) => !employeeIdsInAttendance.includes(employee.employee_id)
//     );

//     if (missingRecords.length > 0) {
//       await createAttendanceRecords(missingRecords, "weekend");
//     }
//   }
// };

// const updateStatusOfNotCheckouts = async () => {
//   try {
//     const { start, end } = getCurrentDayRange();

//     // Fetch attendance records for the current day
//     const attendanceRecords = await mongoFunctions.find("ATTENDANCE", {
//       createdAt: { $gte: start, $lte: end },
//     });

//     // Fetch the list of employees
//     const employees = await mongoFunctions.find("EMPLOYEE");
//     const activeEmployees = employees.filter(
//       (employee) =>
//         employee.work_info.employee_status.toLowerCase() !== "disable" &&
//         employee.work_info.employee_status.toLowerCase() !== "terminated"
//     );

//     // Determine the employee IDs present in the attendance records
//     const employeeIdsInAttendance = new Set(
//       attendanceRecords.map((record) => record.employee_id)
//     );

//     // Find missing employees
//     const missingEmployees = activeEmployees.filter(
//       (employee) => !employeeIdsInAttendance.has(employee.employee_id)
//     );

//     const updates = await Promise.all(
//       attendanceRecords
//         .filter((record) => !record.attendance_status) // Synchronous filter
//         .map(async (record) => {
//           // Asynchronous map
//           const checkout = {
//             out_time: new Date(),
//           };
//           checkout.out_time.setHours(19, 0, 0, 0);
//           let check = await mongoFunctions.find_one_and_update(
//             "ATTENDANCE",
//             { attendance_id: record.attendance_id },
//             { $push: { checkout: checkout } }, // Ensure the field name is correct
//             { new: true } // Return the updated document
//           );

//           const minutes = await calculate_working_minutes(check);
//         })
//     );

//     // Await all updates to complete
//     // await Promise.all(updates);

//     // Create attendance records for missing employees
//     if (missingEmployees.length > 0) {
//       await createAttendanceRecords(missingEmployees, "absent");
//     }
//     alertDev("Attendance status updated successfully for not checked outs");
//   } catch (error) {
//     console.error("Error updating attendance status:", error);
//     alertDev("Failed to update attendance status.");
//   }
// };

// const updateStatusBasedOnHolidays = async () => {
//   const { start, end } = getCurrentDayRange();
//   const attendanceRecord = await mongoFunctions.find("ATTENDANCE", {
//     createdAt: { $gte: start, $lte: end },
//   });
//   const employees = await mongoFunctions.find("EMPLOYEE");
//   const holidays = await mongoFunctions.find("HOLIDAYS");
//   const today = new Date();
//   // today.setHours(0, 0, 0, 0);
//   const todayString = today.toISOString().split("T")[0]; // Get the date in YYYY-MM-DD format

//   const holidayNames = holidays
//     .filter((holiday) => {
//       const holidayDate = new Date(holiday.holiday_date);
//       const holidayString = holidayDate.toISOString().split("T")[0];
//       return holidayString === todayString;
//     })
//     .map((holiday) => holiday.holiday_name);

//   if (holidayNames.length > 0) {
//     const holidayName = holidayNames[0];
//     if (attendanceRecord.length > 0) {
//       // If there are existing records, create records for missing employees
//       const employeeIdsInAttendance = attendanceRecord.map(
//         (record) => record.employee_id
//       );
//       const missingEmployees = employees.filter(
//         (employee) => !employeeIdsInAttendance.includes(employee.employee_id)
//       );

//       if (missingEmployees.length > 0) {
//         await createHolidayRecords(missingEmployees, holidayName, "holiday");
//       }
//     } else {
//       // If no attendance records exist, create for all employees
//       await createHolidayRecords(employees, holidayName, "holiday");
//     }
//   }
// };
// const updateStatusOfNotCheckins = async () => {
//   const { start, end } = getCurrentDayRange();
//   const attendanceRecord = await mongoFunctions.find("ATTENDANCE", {
//     createdAt: { $gte: start, $lte: end },
//   });

//   // Fetch the list of employees
//   const employees = await mongoFunctions.find("EMPLOYEE");
//   const activeEmployees = employees.filter(
//     (employee) =>
//       employee.work_info.employee_status.toLowerCase() !== "disable" &&
//       employee.work_info.employee_status.toLowerCase() !== "terminated"
//   );
//   // Determine the employee IDs present in the attendance records
//   const employeeIdsInAttendance = new Set(
//     attendanceRecord.map((record) => record.employee_id)
//   );
//   // Find missing employees
//   const missingEmployees = activeEmployees.filter(
//     (employee) => !employeeIdsInAttendance.has(employee.employee_id)
//   );
//   if (missingEmployees.length > 0) {
//     await createAttendanceRecords(missingEmployees, "absent");
//   }

//   // Update attendance status for records where the checkin array is empty
//   // const updates = attendanceRecord
//   //   .filter((record) => (!record.checkin || (record.checkin.length === 0 && record.attendance_status==="")))
//   //   .map((record) => {
//   const updates = attendanceRecord
//     .filter(
//       (record) =>
//         record.attendance_status === "" &&
//         (!record.checkin || record.checkin.length === 0)
//     )
//     .map((record) => {
//       const newStatus = "absent";
//       return mongoFunctions.update_many(
//         "ATTENDANCE",
//         { attendance_id: record.attendance_id },
//         { $set: { attendance_status: newStatus, status: newStatus } }
//       );
//     });

//   // Await all updates to complete
//   await Promise.all(updates);
// };
// // Scheduling cron jobs
// cron.schedule(
//   "30 9 * * 1-5",
//   async () => {
//     await updateAttendanceStatus();
//     alertDev("Running cron to update status in weekdays");
//   },
//   { scheduled: true, timezone: "Asia/Kolkata" }
// );
// cron.schedule(
//   "00 11 * * 1-5",
//   async () => {
//     await updateStatusOfNotCheckins();
//     alertDev("Running cron to update absent status in weekdays");
//   },
//   { scheduled: true, timezone: "Asia/Kolkata" }
// );

// cron.schedule(
//   "30 9 * * 6,0",
//   async () => {
//     await updateStatusInWeekends();
//     alertDev("Running cron to update status in holidays and weekends");
//   },
//   { scheduled: true, timezone: "Asia/Kolkata" }
// );

// cron.schedule(
//   "00 21 * * *",
//   async () => {
//     await updateStatusOfNotCheckouts();

//     alertDev("Running cron to update status of not checked outs");
//   },
//   { scheduled: true, timezone: "Asia/Kolkata" }
// );
// // alertDev("Welcome to cg hr portal bot group");

// cron.schedule(
//   "00 9 * * *",
//   async () => {
//     await updateStatusBasedOnHolidays();
//     alertDev("Running cron to update attendance status based on holidays");
//   },
//   { scheduled: true, timezone: "Asia/Kolkata" }
// );

//----------------------new updated code------------------
// const cron = require("node-cron");
var CronJob = require("cron").CronJob;
const moment = require("moment-timezone");

const mongoFunctions = require("./mongoFunctions");
const functions = require("./functions");
const { alertDev } = require("./telegram");
const { calculate_working_minutes } = require("./stats");
const { checkPreferences } = require("joi");
const redisFunctions = require("./redisFunctions");

async function getCurrentDayRange() {
  const now = moment().tz("Asia/Kolkata");
  return {
    start: now.startOf("day").toDate(),
    end: now.endOf("day").toDate(),
  };
}

function getActiveEmployees(employees) {
  return employees.filter((employee) => {
    const status = employee.work_info.employee_status.toLowerCase();
    return status !== "disable" && status !== "terminated";
  });
}
// 1️⃣ Bulk create attendance records
async function createAttendanceRecords(employees, status = "") {
  try {
    const activeEmployees = getActiveEmployees(employees);

    const newRecords = activeEmployees.map((employee) => ({
      organisation_id: employee.organisation_id,
      attendance_id: functions.get_random_string("A", 5, true) + Date.now(),
      employee_id: employee.employee_id,
      employee_name: `${employee.basic_info.first_name} ${employee.basic_info.last_name}`,
      attendance_status: status,
    }));

    // Insert all records at once
    await mongoFunctions.insert_many_records("ATTENDANCE", newRecords);

    // Ensure none missed
    await ensureAllRecordsPresent(activeEmployees, status);

    alertDev(
      `Attendance records created in bulk for ${activeEmployees.length} employees with status '${status}'.`
    );
  } catch (err) {
    console.error("Error in createAttendanceRecords:", err);
    alertDev(`Error creating attendance records: ${err.message}`);
  }
}

// 2️⃣ Ensure all records exist (patch missing in bulk)
async function ensureAllRecordsPresent(activeEmployees, status = "") {
  try {
    const { start, end } = await getCurrentDayRange();

    // Get today’s records
    const todayRecords = await mongoFunctions.find("ATTENDANCE", {
      createdAt: { $gt: start, $lte: end },
    });

    const presentIds = new Set(todayRecords.map((rec) => rec.employee_id));

    // Find missing employees
    const missing = activeEmployees.filter(
      (emp) => !presentIds.has(emp.employee_id)
    );

    if (missing.length > 0) {
      const missingRecords = missing.map((emp) => ({
        organisation_id: emp.organisation_id,
        attendance_id: functions.get_random_string("A", 3, true) + Date.now(),
        employee_id: emp.employee_id,
        employee_name: `${emp.basic_info.first_name} ${emp.basic_info.last_name}`,
        attendance_status: status,
      }));

      await mongoFunctions.insert_many_records("ATTENDANCE", missingRecords);

      alertDev(
        `Patched ${missing.length} missing employee records with status '${status}'.`
      );
    }
  } catch (err) {
    console.error("Error in ensureAllRecordsPresent:", err);
    alertDev(`Error ensuring all records present: ${err.message}`);
  }
}

async function createHolidayRecords(employees, attendance_status, status) {
  try {
    const activeEmployees = getActiveEmployees(employees);

    // Build all records at once
    const newRecords = activeEmployees.map((emp, index) => ({
      organisation_id: emp.organisation_id,
      attendance_id:
        functions.get_random_string("A", 5, true) + (Date.now() + index), // ensure uniqueness
      employee_id: emp.employee_id,
      employee_name: `${emp.basic_info.first_name} ${emp.basic_info.last_name}`,
      attendance_status,
      status,
    }));

    // Retry insert_many_records up to 3 times
    for (let i = 0; i < 3; i++) {
      try {
        await mongoFunctions.insert_many_records("ATTENDANCE", newRecords);
        console.log(`✅ Inserted ${newRecords.length} holiday records.`);
        break; // success, stop retry loop
      } catch (err) {
        console.error(`❌ Attempt ${i + 1} failed: ${err.message}`);
        if (i === 2) {
          alertDev(
            `Holiday: Bulk insert failed after 3 attempts: ${err.message}`
          );
          throw err;
        }
        await new Promise((res) => setTimeout(res, 100)); // wait before retry
      }
    }

    alertDev(
      `Holiday attendance created for '${attendance_status}'/${status}.`
    );
  } catch (err) {
    console.error("Error in createHolidayRecords:", err);
    alertDev(`Error creating holiday records: ${err.message}`);
  }
}

async function updateAttendanceStatus() {
  try {
    const { start, end } = await getCurrentDayRange();
    const attendanceRecord = await mongoFunctions.find("ATTENDANCE", {
      createdAt: { $gt: start, $lte: end },
    });

    const employees = await mongoFunctions.find(
      "EMPLOYEE",
      {},
      { createdAt: -1 },
      {
        employee_id: 1,
        "work_info.employee_status": 1,
        organisation_id: 1,
        "basic_info.first_name": 1,
        "basic_info.last_name": 1,
      }
    );

    const activeEmployees = getActiveEmployees(employees);
    const attendanceSummary = {
      todayAttendanceRecords: attendanceRecord.length,
      totalEmployees: employees.length,
      activeEmployees: activeEmployees.length,
    };

    alertDev(JSON.stringify(attendanceSummary, null, 2));

    const employeeIdsInAttendance = attendanceRecord.map((r) => r.employee_id);
    const missing = activeEmployees.filter(
      (e) => !employeeIdsInAttendance.includes(e.employee_id)
    );
    if (attendanceRecord.length === 0 || missing.length > 0) {
      const recordsToCreate =
        attendanceRecord.length === 0 ? activeEmployees : missing;
      await createAttendanceRecords(recordsToCreate, "");
    }
  } catch (err) {
    console.error("Error in updateAttendanceStatus:", err);
    alertDev(`Error updating attendance status: ${err.message}`);
  }
}

async function updateStatusInWeekends() {
  try {
    const { start, end } = await getCurrentDayRange();
    const attendanceRecord = await mongoFunctions.find("ATTENDANCE", {
      createdAt: { $gt: start, $lte: end },
    });
    const employees = await mongoFunctions.find(
      "EMPLOYEE",
      {},
      { createdAt: -1 },
      {
        employee_id: 1,
        "work_info.employee_status": 1,
        organisation_id: 1,
        "basic_info.first_name": 1,
        "basic_info.last_name": 1,
      }
    );
    const activeEmployees = getActiveEmployees(employees);
    const attendanceSummary = {
      todayAttendanceRecords: attendanceRecord.length,
      totalEmployees: employees.length,
      activeEmployees: activeEmployees.length,
    };

    alertDev(JSON.stringify(attendanceSummary, null, 2));

    if (attendanceRecord.length === 0) {
      await createAttendanceRecords(activeEmployees, "weekend");
    } else {
      const employeeIdsInAttendance = attendanceRecord.map(
        (r) => r.employee_id
      );
      const missing = activeEmployees.filter(
        (e) => !employeeIdsInAttendance.includes(e.employee_id)
      );
      if (missing.length > 0) await createAttendanceRecords(missing, "weekend");
    }
  } catch (err) {
    console.error("Error in updateStatusInWeekends:", err);
    alertDev(`Error updating weekend status: ${err.message}`);
  }
}

async function updateStatusOfNotCheckouts() {
  try {
    const { start, end } = await getCurrentDayRange();
    const attendanceRecords = await mongoFunctions.find("ATTENDANCE", {
      createdAt: { $gt: start, $lte: end },
    });

    const employees = await mongoFunctions.find(
      "EMPLOYEE",
      {},
      { createdAt: -1 },
      {
        employee_id: 1,
        "work_info.employee_status": 1,
        organisation_id: 1,
        "basic_info.first_name": 1,
        "basic_info.last_name": 1,
      }
    );

    const activeEmployees = getActiveEmployees(employees);
    const attendanceSummary = {
      todayAttendanceRecords: attendanceRecords.length,
      totalEmployees: employees.length,
      activeEmployees: activeEmployees.length,
    };

    alertDev(JSON.stringify(attendanceSummary, null, 2));

    const employeeIdsInAttendance = new Set(
      attendanceRecords.map((r) => r.employee_id)
    );
    const missingEmployees = activeEmployees.filter(
      (e) => !employeeIdsInAttendance.has(e.employee_id)
    );

    await Promise.all(
      attendanceRecords
        .filter((r) => !r.attendance_status)
        .map(async (record) => {
          const checkout = { out_time: new Date() };
          checkout.out_time.setHours(19, 0, 0, 0);
          let check = await mongoFunctions.find_one_and_update(
            "ATTENDANCE",
            { attendance_id: record.attendance_id },
            { $push: { checkout } },
            { new: true }
          );
          await calculate_working_minutes(check);
        })
    );

    if (missingEmployees.length > 0)
      await createAttendanceRecords(missingEmployees, "absent");
    alertDev("Attendance status updated successfully for not checked outs");
  } catch (error) {
    console.error("Error updating attendance status:", error);
    alertDev("Failed to update attendance status.");
  }
}

async function updateStatusBasedOnHolidays() {
  try {
    const { start, end } = await getCurrentDayRange();
    const today = new Date();
    const todayString = today.toISOString().split("T")[0];

    // Step 1: Fetch all organisations
    const organisations = await mongoFunctions.find(
      "ORGANISATIONS",
      {},
      {},
      { organisation_id: 1 }
    );

    for (const org of organisations) {
      const orgId = org.organisation_id;

      // Step 2: Fetch holidays for this organisation
      const holidays = await mongoFunctions.find("HOLIDAYS", {
        organisation_id: orgId,
      });

      // Step 3: Fetch employees for this organisation
      const employees = await mongoFunctions.find(
        "EMPLOYEE",
        { organisation_id: orgId },
        { createdAt: -1 },
        {
          employee_id: 1,
          "work_info.employee_status": 1,
          organisation_id: 1,
          "basic_info.first_name": 1,
          "basic_info.last_name": 1,
        }
      );

      // Step 4: Fetch attendance records for today for this organisation
      const attendanceRecord = await mongoFunctions.find("ATTENDANCE", {
        organisation_id: orgId,
        createdAt: { $gt: start, $lte: end },
      });

      // Step 5: Check if today is a holiday
      const holidayNames = holidays
        .filter(({ holiday_date }) => {
          const holidayDay = new Date(holiday_date).toISOString().split("T")[0];
          return holidayDay === todayString;
        })
        .map((h) => h.holiday_name);

      if (holidayNames.length > 0) {
        const holidayName = holidayNames[0];
        alertDev(`Org ${orgId}: Today is holiday---${holidayName}`);

        // Employees present today
        const employeeIdsInAttendance = attendanceRecord.map(
          (r) => r.employee_id
        );

        // Employees missing in attendance
        const missingEmployees = employees.filter(
          (e) => !employeeIdsInAttendance.includes(e.employee_id)
        );

        // Step 6: Create holiday records
        if (attendanceRecord.length > 0) {
          if (missingEmployees.length > 0) {
            await createHolidayRecords(
              missingEmployees,
              holidayName,
              "holiday",
              orgId
            );
          }
        } else {
          await createHolidayRecords(employees, holidayName, "holiday", orgId);
        }
      }
    }
  } catch (err) {
    console.error("Error in updateStatusBasedOnHolidays:", err);
    alertDev(`Error updating attendance based on holidays: ${err.message}`);
  }
}

async function updateStatusOfNotCheckins() {
  try {
    const { start, end } = await getCurrentDayRange();
    const attendanceRecord = await mongoFunctions.find("ATTENDANCE", {
      createdAt: { $gt: start, $lte: end },
    });

    const employees = await mongoFunctions.find(
      "EMPLOYEE",
      {},
      { createdAt: -1 },
      {
        employee_id: 1,
        "work_info.employee_status": 1,
        organisation_id: 1,
        "basic_info.first_name": 1,
        "basic_info.last_name": 1,
      }
    );

    const activeEmployees = getActiveEmployees(employees);
    const attendanceSummary = {
      todayAttendanceRecords: attendanceRecord.length,
      totalEmployees: employees.length,
      activeEmployees: activeEmployees.length,
    };

    alertDev(JSON.stringify(attendanceSummary, null, 2));

    const employeeIdsInAttendance = new Set(
      attendanceRecord.map((r) => r.employee_id)
    );
    const missingEmployees = activeEmployees.filter(
      (emp) => !employeeIdsInAttendance.has(emp.employee_id)
    );
    if (missingEmployees.length > 0)
      await createAttendanceRecords(missingEmployees, "absent");

    const updates = attendanceRecord
      .filter(
        (record) =>
          record.attendance_status === "" &&
          (!record.checkin || record.checkin.length === 0)
      )
      .map((record) =>
        mongoFunctions.update_many(
          "ATTENDANCE",
          { attendance_id: record.attendance_id },
          { $set: { attendance_status: "absent", status: "absent" } }
        )
      );
    await Promise.all(updates);
  } catch (err) {
    console.error("Error in updateStatusOfNotCheckins:", err);
    alertDev(`Error updating not checkins: ${err.message}`);
  }
}

//cron to create attendance records in weekdays
new CronJob(
  "30 9 * * 1-5",
  async () => {
    try {
      await updateAttendanceStatus();
      alertDev("Running cron to update status in weekdays");
    } catch (err) {
      console.error("Error in weekday cron:", err);
      alertDev(`Error in weekday cron job: ${err.message}`);
    }
  },
  null,
  true,
  "Asia/Kolkata"
);
//cron to run absentees in weekdays

new CronJob(
  "00 11 * * 1-5",
  async () => {
    try {
      await updateStatusOfNotCheckins();
      alertDev("Running cron to update absent status in weekdays");
    } catch (err) {
      console.error("Error in absent status cron:", err);
      alertDev(`Error in absent status cron: ${err.message}`);
    }
  },
  null,
  true,
  "Asia/Kolkata"
);
//cron to update status in weekends
new CronJob(
  "30 9 * * 6,0",
  async () => {
    try {
      await updateStatusInWeekends();
      alertDev("Running cron to update status in weekends");
    } catch (err) {
      console.error("Error in weekend cron:", err);
      alertDev(`Error in weekend cron job: ${err.message}`);
    }
  },
  null,
  true,
  "Asia/Kolkata"
);
//cron to update checkout for not checkouts
new CronJob(
  "00 21 * * *",
  async () => {
    try {
      await updateStatusOfNotCheckouts();
      alertDev("Running cron to update status of not checked outs");
    } catch (err) {
      console.error("Error in not checked out cron:", err);
      alertDev(`Error in not checked out cron job: ${err.message}`);
    }
  },
  null,
  true,
  "Asia/Kolkata"
);
//cron to update holiday status in holidays
new CronJob(
  "00 9 * * *",
  async () => {
    try {
      await updateStatusBasedOnHolidays();
      alertDev("Running cron to update attendance status based on holidays");
    } catch (err) {
      console.error("Error in holiday cron:", err);
      alertDev(`Error in holiday cron job: ${err.message}`);
    }
  },
  null,
  true,
  "Asia/Kolkata"
);
