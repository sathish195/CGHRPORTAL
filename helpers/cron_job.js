const cron = require('node-cron');
const mongoFunctions = require('./mongoFunctions');
const { alertDev } = require('./telegram');

const updateAttendanceStatus = async () => {
    const attendanceRecords = await mongoFunctions.find("ATTENDANCE");

    const updates = attendanceRecords.map(record => {
        if (record.attendance_status === null || record.attendance_status === '') { 
            const newStatus = record.total_working_minutes < 480 ? 'absent' : 'present'; 
            record.attendance_status = newStatus;
            return mongoFunctions.update_many("ATTENDANCE", {attendance_id:record.attendance_id}, {$set:{ attendance_status: newStatus} }); 
        }
        return null; 
    }).filter(Boolean); 

    await Promise.all(updates);
    console.log("Attendance status updated successfully.");
    alertDev("Attendance status updated successfully")
};

cron.schedule(
    "0 0 * * *",
    () => {
        updateAttendanceStatus();
        alertDev("running cron to update status")
        console.log("Running a job every day at 12:00 AM to update attendance status at Asia/Kolkata timezone");
    },
    {
        scheduled: true,
        timezone: "Asia/Kolkata",
    }
);
