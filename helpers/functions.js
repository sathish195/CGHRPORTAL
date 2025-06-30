const crypto = require("crypto");
const { employee_id } = require("./schema");
const mongoFunctions = require("./mongoFunctions");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

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
    // const date1 = new Date(from_date);
    // const date2 = new Date(to_date);

    // // Ensure the start date is before the end date
    // if (date1 > date2) {
    //   throw new Error("Start date must be before or equal to end date");
    // }

    // // Calculate the difference in time, inclusive of both start and end dates
    // const timeDifference = date2 - date1;

    // // Convert time difference from milliseconds to days and add 1 to include both endpoints
    // const dayDifference = Math.ceil(timeDifference / (1000 * 60 * 60 * 24)) + 1;

    // return dayDifference;
    const date1 = new Date(from_date);
    const date2 = new Date(to_date);

    // Ensure the start date is before or equal to the end date
    if (date1 > date2) {
      throw new Error("Start date must be before or equal to end date");
    }

    let totalDays = 0;

    // Iterate through each day in the range
    for (
      let currentDate = date1;
      currentDate <= date2;
      currentDate.setDate(currentDate.getDate() + 1)
    ) {
      const dayOfWeek = currentDate.getDay();

      // Increment totalDays only for weekdays (Monday to Friday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // 0 is Sunday, 6 is Saturday
        totalDays++;
      }
    }
    console.log(totalDays);
    return totalDays;
  },
  add_overall_stats: async (object, date) => {
    if (object.checkin.length === 1 || object.checkin.length === 0) {
      const query = {
        organisation_id: object.organisation_id,
        // employee_id: object.employee_id,
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(24, 0, 0, 0)),
        },
      };

      const update = {
        $setOnInsert: {
          organisation_id: object.organisation_id,
          // employee_id: object.employee_id,
          createdAt: date,
        },
        $inc: {
          "attendance_stats.checkin": object.status === "checkin" ? 1 : 0,
          "attendance_stats.late_checkins":
            object.status === "checkin" &&
            object.late_checkin === true &&
            object.checkout.length !== 1
              ? 1
              : 0,
          "attendance_stats.leave": object.status === "leave" ? 1 : 0,
        },
      };

      const result = await mongoFunctions.find_one_and_update(
        "STATS",
        query,
        update,
        { upsert: true, returnDocument: "after" }
      );

      console.log("Result:", result);
    }
  },

  update_status: (leave_status_up) => {},
  mongoBackup: async () => {
    const collectionNames = [
      "EMPLOYEE",
      "ORGANISATIONS ",
      "PROJECTS",
      "TASKS",
      "STATS",
      "LEAVE",
      "ATTENDANCE",
      "HOLIDAYS",
    ];

    console.log("Collections found:", collectionNames);

    for (const name of collectionNames) {
      await mongoFunctions.download_collection(name);
    }
    console.log("completed dumping");
    return true;
  },
  mongoRestore: async () => {
    const collectionNames = [
      "EMPLOYEE",
      "ORGANISATIONS ",
      "PROJECTS",
      "TASKS",
      "STATS",
      "LEAVE",
      "ATTENDANCE",
      "HOLIDAYS",
    ];

    console.log("Collections found:", collectionNames);

    for (const collection of collectionNames) {
      const filePath = path.join(
        process.cwd(),
        "dump",
        `${collection}_dump.json`
      );

      if (!fs.existsSync(filePath)) {
        alertDev(`❌ Dump file not found for ${collection}`);
        continue;
      }

      const jsonData = fs.readFileSync(filePath, "utf-8");
      const docs = JSON.parse(jsonData);

      if (!Array.isArray(docs) || docs.length === 0) {
        alertDev(`⚠️ No documents to restore for collection: ${collection}`);
        continue;
      }
      let d = await mongoFunctions.delete_many(collection);
      let s = await mongoFunctions.insert_many_records(collection, docs);

      console.log(
        `✅ Restored ${docs.length} documents to collection: ${collection}`
      );
    }
    return true;
  },
  downloadZip: async () => {
    // Step 1: Get the list of files
    let BASE_URL = "https://lucky2-ref.onrender.com";
    const listResponse = await axios.get(`${BASE_URL}/org/download_zip`);
    const files = listResponse.data;

    if (!files.length) {
      console.log("No files found.");
      return;
    }

    // Step 2: Ensure local /dump folder exists
    const dumpPath = path.join(__dirname, "dump");
    if (!fs.existsSync(dumpPath)) {
      fs.mkdirSync(dumpPath, { recursive: true });
      console.log("📁 Created local folder: dump");
    }

    // Step 3: Download each file using the same filename
    for (const file of files) {
      const fileUrl = `${BASE_URL}${file.downloadUrl}`;
      const localPath = path.join(dumpPath, file.filename);

      console.log(`⬇️ Downloading: ${file.filename}`);

      const response = await axios.get(fileUrl, { responseType: "stream" });
      const writer = fs.createWriteStream(localPath);

      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      console.log(`✅ Saved: ${file.filename}`);
    }

    console.log("🎉 All files downloaded to ./dump/");
  },
};
