const cron = require("node-cron");
const mongoFunctions = require("./mongoFunctions");
const { alertDev } = require("./telegram");
const functions = require("./functions");

const updateAttendanceStatus = async () => {
  const attendanceRecords = await mongoFunctions.find("ATTENDANCE");
  const now = new Date();
  const start_day = new Date(now.setHours(0, 0, 0, 0));
  const end_day = new Date(now.setHours(23, 59, 59, 999));
  const attendanceRecord = await mongoFunctions.find("ATTENDANCE", {
    createdAt: {
      $gte: start_day,
      $lte: end_day,
    },
  });
  // Get all employees
  const employees = await mongoFunctions.find("EMPLOYEE");

  if (attendanceRecord.length === 0) {
    // Create attendance records for all employees with status 'absent'
    const absenceUpdates = employees.map((employee) => {
      const newRecord = {
        organisation_id: employee.organisation_id,
        attendance_id: functions.get_random_string("A", 3, true) + Date.now(),
        employee_id: employee.employee_id,
        employee_name: `${employee.basic_info.first_name} ${employee.basic_info.last_name}`,
        attendance_status: "absent",
      };
      return mongoFunctions.create_new_record("ATTENDANCE", newRecord);
    });

    await Promise.all(absenceUpdates);
    console.log(
      "Attendance records created for all employees with status 'absent'."
    );
    alertDev(
      "Attendance records created for all employees with status 'absent'."
    );
  } else {
    const updates = attendanceRecords
      .map((record) => {
        if (
          record.attendance_status === null ||
          record.attendance_status === ""
        ) {
          let newStatus = "absent";

          //   const totalWorkingMinutes = record.total_working_minutes;

          //   if (totalWorkingMinutes < 60) {
          //     newStatus = "absent";
          //   } else if (totalWorkingMinutes < 420) {
          //     // If it is less than 7 hours it should be half day present and half day absent
          //     newStatus = "0.5 day present, 0.5 day absent";
          //   } else if (totalWorkingMinutes >= 480) {
          //     // 8 hours or more
          //     newStatus = "present";
          //   } else {
          //     newStatus = "absent";
          //   }

          record.attendance_status = newStatus;
          return mongoFunctions.update_many(
            "ATTENDANCE",
            { attendance_id: record.attendance_id },
            { $set: { attendance_status: newStatus } }
          );
        }
        return null;
      })
      .filter(Boolean);

    await Promise.all(updates);
    console.log("Attendance status updated successfully.");
    alertDev("Attendance status updated successfully");
  }
  // Check for missing employee attendance records
  const employeeIdsInAttendance = attendanceRecords.map(
    (record) => record.employee_id
  );
  const missingRecords = employees.filter(
    (employee) => !employeeIdsInAttendance.includes(employee.employee_id)
  );

  if (missingRecords.length > 0) {
    const absenceUpdates = missingRecords.map((employee) => {
      const newRecord = {
        organisation_id: employee.organisation_id,
        attendance_id: functions.get_random_string("A", 3, true) + Date.now(),
        employee_id: employee.employee_id,
        employee_name: `${employee.basic_info.first_name} ${employee.basic_info.last_name}`,
        attendance_status: "absent",
      };
      return mongoFunctions.create_new_record("ATTENDANCE", newRecord);
    });

    await Promise.all(absenceUpdates);
    console.log(
      "Attendance records created for missing employees with status 'absent'."
    );
    alertDev(
      "Attendance records created for missing employees with status 'absent'."
    );
  }
};
cron.schedule(
  "59 11 * * *",
  () => {
    updateAttendanceStatus();
    alertDev("running cron to update status");
    console.log(
      "Running a job every day at 12:00 AM to update attendance status at Asia/Kolkata timezone"
    );
  },
  {
    scheduled: true,
    timezone: "Asia/Kolkata",
  }
);
