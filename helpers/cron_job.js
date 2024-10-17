const cron = require("node-cron");
const mongoFunctions = require("./mongoFunctions");
const { alertDev } = require("./telegram");
const functions = require("./functions");

const getCurrentDayRange = () => {
  const now = new Date();
  return {
    start: new Date(now.setHours(0, 0, 0, 0)),
    end: new Date(now.setHours(23, 59, 59, 999)),
  };
};

const createAttendanceRecords = async (employees, status = "") => {
  const absenceUpdates = employees.map((employee) => {
    const newRecord = {
      organisation_id: employee.organisation_id,
      attendance_id: functions.get_random_string("A", 3, true) + Date.now(),
      employee_id: employee.employee_id,
      employee_name: `${employee.basic_info.first_name} ${employee.basic_info.last_name}`,
      attendance_status: status,
    };
    return mongoFunctions.create_new_record("ATTENDANCE", newRecord);
  });

  await Promise.all(absenceUpdates);
  console.log(
    `Attendance records created for all employees with status '${status}'.`
  );
  alertDev(
    `Attendance records created for all employees with status '${status}'.`
  );
};

const updateAttendanceStatus = async () => {
  const { start, end } = getCurrentDayRange();
  const attendanceRecord = await mongoFunctions.find("ATTENDANCE", {
    createdAt: { $gt: start, $lte: end },
  });
  const employees = await mongoFunctions.find("EMPLOYEE");

  const employeeIdsInAttendance = attendanceRecord.map(
    (record) => record.employee_id
  );
  const missingRecords = employees.filter(
    (employee) => !employeeIdsInAttendance.includes(employee.employee_id)
  );

  if (attendanceRecord.length === 0 || missingRecords.length > 0) {
    const recordsToCreate =
      attendanceRecord.length === 0 ? employees : missingRecords;
    await createAttendanceRecords(
      recordsToCreate,
      attendanceRecord.length === 0 ? "" : ""
    );
  }
};

const updateStatusInWeekends = async () => {
  const { start, end } = getCurrentDayRange();
  const attendanceRecord = await mongoFunctions.find("ATTENDANCE", {
    createdAt: { $gt: start, $lte: end },
  });
  const employees = await mongoFunctions.find("EMPLOYEE");

  if (attendanceRecord.length === 0) {
    await createAttendanceRecords(employees, "weekend");
  } else {
    const employeeIdsInAttendance = attendanceRecord.map(
      (record) => record.employee_id
    );
    const missingRecords = employees.filter(
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
      createdAt: { $gt: start, $lte: end },
    });

    // Fetch the list of employees
    const employees = await mongoFunctions.find("EMPLOYEE");

    // Determine the employee IDs present in the attendance records
    const employeeIdsInAttendance = new Set(
      attendanceRecords.map((record) => record.employee_id)
    );

    // Find missing employees
    const missingEmployees = employees.filter(
      (employee) => !employeeIdsInAttendance.has(employee.employee_id)
    );

    // Update attendance status for records without a status
    const updates = attendanceRecords
      .filter((record) => !record.attendance_status)
      .map((record) => {
        const newStatus = "absent";
        return mongoFunctions.update_many(
          // Change to updateMany if necessary
          "ATTENDANCE",
          { attendance_id: record.attendance_id },
          { $set: { attendance_status: newStatus } }
        );
      });

    // Await all updates to complete
    await Promise.all(updates);

    // Create attendance records for missing employees
    if (missingEmployees.length > 0) {
      await createAttendanceRecords(missingEmployees, "absent");
    }

    console.log("Attendance status updated successfully for not checked outs.");
    alertDev("Attendance status updated successfully for not checked outs");
  } catch (error) {
    console.error("Error updating attendance status:", error);
    alertDev("Failed to update attendance status.");
  }
};

const updateStatusBasedOnHolidays = async () => {
  const { start, end } = getCurrentDayRange();
  const attendanceRecord = await mongoFunctions.find("ATTENDANCE", {
    createdAt: { $gt: start, $lte: end },
  });
  const employees = await mongoFunctions.find("EMPLOYEE");
  const holidays = await mongoFunctions.find("HOLIDAYS");
  const today = new Date();

  const holidayNames = holidays
    .filter((holiday) => holiday.holiday_date === today)
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
        await createAttendanceRecords(missingEmployees, holidayName);
      }
    } else {
      // If no attendance records exist, create for all employees
      await createAttendanceRecords(employees, holidayName);
    }
  }
  console.log("Holiday not found");
};
const updateStatusOfNotCheckins = async () => {
  const { start, end } = getCurrentDayRange();
  const attendanceRecord = await mongoFunctions.find("ATTENDANCE", {
    createdAt: { $gt: start, $lte: end },
  });

  // Update attendance status for records where the checkin array is empty
  const updates = attendanceRecord
    .filter((record) => !record.checkin || record.checkin.length === 0)
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
    console.log(
      "Running a job every day at 9:30 AM to update attendance status at Asia/Kolkata timezone"
    );
  },
  { scheduled: true, timezone: "Asia/Kolkata" }
);
cron.schedule(
  "25 11 * * 1-5",
  async () => {
    await updateStatusOfNotCheckins();
    alertDev("Running cron to update absent status in weekdays");
    console.log(
      "Running a job every day at 11:05 AM to update attendance status at Asia/Kolkata timezone"
    );
  },
  { scheduled: true, timezone: "Asia/Kolkata" }
);

cron.schedule(
  "30 9 * * 6,0",
  async () => {
    await updateStatusInWeekends();
    alertDev("Running cron to update status in holidays and weekends");
    console.log(
      "Running a job every day at 9:30 AM to update attendance status in weekends at Asia/Kolkata timezone"
    );
  },
  { scheduled: true, timezone: "Asia/Kolkata" }
);

cron.schedule(
  "30 23 * * *",
  async () => {
    console.log("running cron");
    await updateStatusOfNotCheckouts();

    alertDev("Running cron to update status of not checked outs");
    console.log(
      "Running a job every day at 11:30 PM to update attendance of not checked outs at Asia/Kolkata timezone"
    );
  },
  { scheduled: true, timezone: "Asia/Kolkata" }
);

cron.schedule(
  "41 17 * * *",
  async () => {
    await updateStatusBasedOnHolidays();
    alertDev("Running cron to update attendance status based on holidays");
    console.log(
      "Running a job every day at midnight to update attendance status based on holiday list at Asia/Kolkata timezone"
    );
  },
  { scheduled: true, timezone: "Asia/Kolkata" }
);
