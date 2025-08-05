const cron = require("node-cron");
const mongoFunctions = require("./mongoFunctions");
const { alertDev } = require("./telegram");
//
const functions = require("./functions");
const { checkPreferences } = require("joi");
const { calculate_working_minutes } = require("./stats");
const moment = require("moment-timezone");
const getCurrentDayRange = () => {
  const now = moment().tz("Asia/Kolkata");
  return {
    start: now.startOf("day").toDate(),
    end: now.endOf("day").toDate(),
  };
};

// const getCurrentDayRange = () => {
//   const now = new Date();
//   return {
//     start: new Date(now.setHours(0, 0, 0, 0)),
//     end: new Date(now.setHours(23, 59, 59, 999)),
//   };
// };

const createAttendanceRecords = async (employees, status = "") => {
  const activeEmployees = employees.filter(
    (employee) =>
      employee.work_info.employee_status.toLowerCase() !== "disable" &&
      employee.work_info.employee_status.toLowerCase() !== "terminated"
  );
  const absenceUpdates = activeEmployees.map((employee) => {
    const newRecord = {
      organisation_id: employee.organisation_id,
      attendance_id: functions.get_random_string("A", 3, true) + Date.now(),
      employee_id: employee.employee_id,
      employee_name: `${employee.basic_info.first_name} ${employee.basic_info.last_name}`,
      attendance_status: status,
      // status:stat
    };
    return mongoFunctions.create_new_record("ATTENDANCE", newRecord);
  });

  await Promise.all(absenceUpdates);
  alertDev(
    `Attendance records created for all employees with status '${status}'.`
  );
};
const createHolidayRecords = async (
  employees,
  attendance_status = "",
  status
) => {
  const activeEmployees = employees.filter(
    (employee) =>
      employee.work_info.employee_status.toLowerCase() !== "disable" &&
      employee.work_info.employee_status.toLowerCase() !== "terminated"
  );
  const absenceUpdates = activeEmployees.map((employee) => {
    const newRecord = {
      organisation_id: employee.organisation_id,
      attendance_id: functions.get_random_string("A", 3, true) + Date.now(),
      employee_id: employee.employee_id,
      employee_name: `${employee.basic_info.first_name} ${employee.basic_info.last_name}`,
      attendance_status: attendance_status,
      status: status,
    };
    return mongoFunctions.create_new_record("ATTENDANCE", newRecord);
  });

  await Promise.all(absenceUpdates);
  alertDev(
    `Attendance records created for all employees with status '${status}'.`
  );
};

const updateAttendanceStatus = async () => {
  const { start, end } = getCurrentDayRange();
  const attendanceRecord = await mongoFunctions.find("ATTENDANCE", {
    createdAt: { $gte: start, $lte: end },
  });
  const employees = await mongoFunctions.find("EMPLOYEE");
  const activeEmployees = employees.filter(
    (employee) =>
      employee.work_info.employee_status.toLowerCase() !== "disable" &&
      employee.work_info.employee_status.toLowerCase() !== "terminated"
  );

  const employeeIdsInAttendance = attendanceRecord.map(
    (record) => record.employee_id
  );
  const missingRecords = activeEmployees.filter(
    (employee) => !employeeIdsInAttendance.includes(employee.employee_id)
  );

  if (attendanceRecord.length === 0 || missingRecords.length > 0) {
    const recordsToCreate =
      attendanceRecord.length === 0 ? activeEmployees : missingRecords;
    await createAttendanceRecords(
      recordsToCreate,
      attendanceRecord.length === 0 ? "" : ""
    );
  }
};

const updateStatusInWeekends = async () => {
  const { start, end } = getCurrentDayRange();
  const attendanceRecord = await mongoFunctions.find("ATTENDANCE", {
    createdAt: { $gte: start, $lte: end },
  });
  const employees = await mongoFunctions.find("EMPLOYEE");
  const activeEmployees = employees.filter(
    (employee) =>
      employee.work_info.employee_status.toLowerCase() !== "disable" &&
      employee.work_info.employee_status.toLowerCase() !== "terminated"
  );

  if (attendanceRecord.length === 0) {
    await createAttendanceRecords(activeEmployees, "weekend");
  } else {
    const employeeIdsInAttendance = attendanceRecord.map(
      (record) => record.employee_id
    );
    const missingRecords = activeEmployees.filter(
      (employee) => !employeeIdsInAttendance.includes(employee.employee_id)
    );

    if (missingRecords.length > 0) {
      await createAttendanceRecords(missingRecords, "weekend");
    }
  }
};

const updateStatusOfNotCheckouts = async () => {
  try {
    const { start, end } = getCurrentDayRange();

    // Fetch attendance records for the current day
    const attendanceRecords = await mongoFunctions.find("ATTENDANCE", {
      createdAt: { $gte: start, $lte: end },
    });

    // Fetch the list of employees
    const employees = await mongoFunctions.find("EMPLOYEE");
    const activeEmployees = employees.filter(
      (employee) =>
        employee.work_info.employee_status.toLowerCase() !== "disable" &&
        employee.work_info.employee_status.toLowerCase() !== "terminated"
    );

    // Determine the employee IDs present in the attendance records
    const employeeIdsInAttendance = new Set(
      attendanceRecords.map((record) => record.employee_id)
    );

    // Find missing employees
    const missingEmployees = activeEmployees.filter(
      (employee) => !employeeIdsInAttendance.has(employee.employee_id)
    );

    const updates = await Promise.all(
      attendanceRecords
        .filter((record) => !record.attendance_status) // Synchronous filter
        .map(async (record) => {
          // Asynchronous map
          const checkout = {
            out_time: new Date(),
          };
          checkout.out_time.setHours(19, 0, 0, 0);
          let check = await mongoFunctions.find_one_and_update(
            "ATTENDANCE",
            { attendance_id: record.attendance_id },
            { $push: { checkout: checkout } }, // Ensure the field name is correct
            { new: true } // Return the updated document
          );

          const minutes = await calculate_working_minutes(check);
        })
    );

    // Await all updates to complete
    // await Promise.all(updates);

    // Create attendance records for missing employees
    if (missingEmployees.length > 0) {
      await createAttendanceRecords(missingEmployees, "absent");
    }
    alertDev("Attendance status updated successfully for not checked outs");
  } catch (error) {
    console.error("Error updating attendance status:", error);
    alertDev("Failed to update attendance status.");
  }
};

const updateStatusBasedOnHolidays = async () => {
  const { start, end } = getCurrentDayRange();
  const attendanceRecord = await mongoFunctions.find("ATTENDANCE", {
    createdAt: { $gte: start, $lte: end },
  });
  const employees = await mongoFunctions.find("EMPLOYEE");
  const holidays = await mongoFunctions.find("HOLIDAYS");
  const today = new Date();
  // today.setHours(0, 0, 0, 0);
  const todayString = today.toISOString().split("T")[0]; // Get the date in YYYY-MM-DD format

  const holidayNames = holidays
    .filter((holiday) => {
      const holidayDate = new Date(holiday.holiday_date);
      const holidayString = holidayDate.toISOString().split("T")[0];
      return holidayString === todayString;
    })
    .map((holiday) => holiday.holiday_name);

  if (holidayNames.length > 0) {
    const holidayName = holidayNames[0];
    if (attendanceRecord.length > 0) {
      // If there are existing records, create records for missing employees
      const employeeIdsInAttendance = attendanceRecord.map(
        (record) => record.employee_id
      );
      const missingEmployees = employees.filter(
        (employee) => !employeeIdsInAttendance.includes(employee.employee_id)
      );

      if (missingEmployees.length > 0) {
        await createHolidayRecords(missingEmployees, holidayName, "holiday");
      }
    } else {
      // If no attendance records exist, create for all employees
      await createHolidayRecords(employees, holidayName, "holiday");
    }
  }
};
const updateStatusOfNotCheckins = async () => {
  const { start, end } = getCurrentDayRange();
  const attendanceRecord = await mongoFunctions.find("ATTENDANCE", {
    createdAt: { $gte: start, $lte: end },
  });

  // Fetch the list of employees
  const employees = await mongoFunctions.find("EMPLOYEE");
  const activeEmployees = employees.filter(
    (employee) =>
      employee.work_info.employee_status.toLowerCase() !== "disable" &&
      employee.work_info.employee_status.toLowerCase() !== "terminated"
  );
  // Determine the employee IDs present in the attendance records
  const employeeIdsInAttendance = new Set(
    attendanceRecord.map((record) => record.employee_id)
  );
  // Find missing employees
  const missingEmployees = activeEmployees.filter(
    (employee) => !employeeIdsInAttendance.has(employee.employee_id)
  );
  if (missingEmployees.length > 0) {
    await createAttendanceRecords(missingEmployees, "absent");
  }

  // Update attendance status for records where the checkin array is empty
  // const updates = attendanceRecord
  //   .filter((record) => (!record.checkin || (record.checkin.length === 0 && record.attendance_status==="")))
  //   .map((record) => {
  const updates = attendanceRecord
    .filter(
      (record) =>
        record.attendance_status === "" &&
        (!record.checkin || record.checkin.length === 0)
    )
    .map((record) => {
      const newStatus = "absent";
      return mongoFunctions.update_many(
        "ATTENDANCE",
        { attendance_id: record.attendance_id },
        { $set: { attendance_status: newStatus, status: newStatus } }
      );
    });

  // Await all updates to complete
  await Promise.all(updates);
};
// Scheduling cron jobs
cron.schedule(
  "30 9 * * 1-5",
  async () => {
    await updateAttendanceStatus();
    alertDev("Running cron to update status in weekdays");
  },
  { scheduled: true, timezone: "Asia/Kolkata" }
);
cron.schedule(
  "00 11 * * 1-5",
  async () => {
    await updateStatusOfNotCheckins();
    alertDev("Running cron to update absent status in weekdays");
  },
  { scheduled: true, timezone: "Asia/Kolkata" }
);

cron.schedule(
  "30 9 * * 6,0",
  async () => {
    await updateStatusInWeekends();
    alertDev("Running cron to update status in holidays and weekends");
  },
  { scheduled: true, timezone: "Asia/Kolkata" }
);

cron.schedule(
  "00 21 * * *",
  async () => {
    await updateStatusOfNotCheckouts();

    alertDev("Running cron to update status of not checked outs");
  },
  { scheduled: true, timezone: "Asia/Kolkata" }
);
// alertDev("Welcome to cg hr portal bot group");

cron.schedule(
  "00 9 * * *",
  async () => {
    await updateStatusBasedOnHolidays();
    alertDev("Running cron to update attendance status based on holidays");
  },
  { scheduled: true, timezone: "Asia/Kolkata" }
);
