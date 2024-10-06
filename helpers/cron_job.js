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

const updateStatusInHolidays = async () => {
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
  const { start, end } = getCurrentDayRange();
  const attendanceRecord = await mongoFunctions.find("ATTENDANCE", {
    createdAt: { $gt: start, $lte: end },
  });

  const updates = attendanceRecord
    .filter((record) => !record.attendance_status)
    .map((record) => {
      const newStatus = "absent";
      return mongoFunctions.update_many(
        "ATTENDANCE",
        { attendance_id: record.attendance_id },
        { $set: { attendance_status: newStatus } }
      );
    });

  await Promise.all(updates);
  console.log("Attendance status updated successfully for not checked outs.");
  alertDev("Attendance status updated successfully for not checked outs");
};

// Scheduling cron jobs
cron.schedule(
  "30 9 * * 1-5",
  async () => {
    await updateAttendanceStatus();
    alertDev("Running cron to update status in weekdays");
    console.log(
      "Running a job every day at 10:00 AM to update attendance status at Asia/Kolkata timezone"
    );
  },
  { scheduled: true, timezone: "Asia/Kolkata" }
);

cron.schedule(
  "30 9 * * 6,0",
  async () => {
    await updateStatusInHolidays();
    alertDev("Running cron to update status in holidays and weekends");
    console.log(
      "Running a job every day at 12:00 PM to update attendance status in weekends at Asia/Kolkata timezone"
    );
  },
  { scheduled: true, timezone: "Asia/Kolkata" }
);

cron.schedule(
  "30 23 * * *",
  async () => {
    await updateStatusOfNotCheckouts();
    alertDev("Running cron to update status of not checked outs");
    console.log(
      "Running a job every day at 11:59 PM to update attendance of not checked outs at Asia/Kolkata timezone"
    );
  },
  { scheduled: true, timezone: "Asia/Kolkata" }
);
