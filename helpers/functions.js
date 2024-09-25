const crypto = require("crypto");

module.exports = {
  get_random_string: (str, length, pre_append = false) => {
    if (str === "0")
      return crypto
        .randomBytes(Number(length / 2))
        .toString("hex")
        .toUpperCase();
    else if (pre_append) {
      return (
        str +
        crypto
          .randomBytes(Number(length / 2))
          .toString("hex")
          .toUpperCase()
      );
    }
    return (
      crypto
        .randomBytes(Number(length / 2))
        .toString("hex")
        .toUpperCase() + str
    );
  },
  weekends_apply: async (from_date, to_date) => {
    const fromDate = new Date(from_date);
    const toDate = new Date(to_date);

    const isFromWeekend = fromDate.getDay() === 6 || fromDate.getDay() === 0; // Saturday is 6, Sunday is 0
    const isToWeekend = toDate.getDay() === 6 || toDate.getDay() === 0;
    console.log(isFromWeekend, isToWeekend);
    return isFromWeekend && isToWeekend;
  },
  get_time_diff_minutes: async (date1, date2) => {
    const diffInMs = new Date(date1) - new Date(date2);
    const diffInMinutes = diffInMs / (1000 * 60);
    return diffInMinutes;
  },
  get_time_of_emp_time_zone: async () => {
    // Indian Standard Time (IST) offset
    const offsetHours = 5;
    const offsetMinutes = 30;

    // Get the current UTC time
    const now = new Date();

    // Calculate the offset in milliseconds
    const offsetInMs = (offsetHours * 60 + offsetMinutes) * 60 * 1000;

    // Create a new date object adjusted by the offset
    const localTime = new Date(now.getTime() + offsetInMs);

    // Format year, month, day, hours, minutes, and seconds with leading zeros if needed
    const year = localTime.getUTCFullYear();
    const month = String(localTime.getUTCMonth() + 1).padStart(2, "0");
    const day = String(localTime.getUTCDate()).padStart(2, "0");
    const hours = String(localTime.getUTCHours()).padStart(2, "0");
    const minutes = String(localTime.getUTCMinutes()).padStart(2, "0");
    const seconds = String(localTime.getUTCSeconds()).padStart(2, "0");

    // Return formatted date and time string
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  },

  get_full_date_time: async (time_string) => {
    const [hours, minutes] = time_string.split(":").map(Number);
    const now = new Date();
    now.setHours(hours, minutes, 0, 0);
    return now;
  },

  calculate_leave_days: (from_date, to_date) => {
    // Parse the date strings into Date objects
    const date1 = new Date(from_date);
    const date2 = new Date(to_date);

    // Ensure the start date is before the end date
    if (date1 > date2) {
      throw new Error("Start date must be before or equal to end date");
    }

    // Calculate the difference in time, inclusive of both start and end dates
    const timeDifference = date2 - date1;

    // Convert time difference from milliseconds to days and add 1 to include both endpoints
    const dayDifference = Math.ceil(timeDifference / (1000 * 60 * 60 * 24)) + 1;

    return dayDifference;
  },
  update_status: (leave_status_up) => {},
};
