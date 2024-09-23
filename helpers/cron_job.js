const cron = require("node-cron");
const mongoFunctions = require("./mongoFunctions");
const { alertDev } = require("./telegram");

const updateAttendanceStatus = async () => {
  const attendanceRecords = await mongoFunctions.find("ATTENDANCE");

  const updates = attendanceRecords
    .map((record) => {
      if (
        record.attendance_status === null ||
        record.attendance_status === ""
      ) {
        let newStatus;

        const totalWorkingMinutes = record.total_working_minutes;

        if (totalWorkingMinutes < 60) {
          newStatus = "absent";
        } else if (totalWorkingMinutes < 420) {
          // less than 7 hours
          newStatus = "0.5 day present, 0.5 day absent";
        } else if (totalWorkingMinutes >= 480) {
          // 8 hours or more
          newStatus = "present";
        } else {
          newStatus = "absent";
        }

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
};

cron.schedule(
  "0 0 * * *",
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
