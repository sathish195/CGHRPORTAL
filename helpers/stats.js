const mongoFunctions = require("./mongoFunctions");
const mongofunctions = require("./mongoFunctions");
const redis = require("./redisFunctions");
const moment = require("moment");
const { employee_id } = require("./schema");
const { calculate_leave_days } = require("./functions");

module.exports = {
  update_emp: async (obj, add = true, new_emp = true) => {
    if (obj && obj.personal_details.date_of_birth) {
      let dob = obj.personal_details.date_of_birth;
      const date = moment(dob, "DDMMYYYY");
      const month_number = date.format("MM");
      let birthdays = await redis.redisGet(
        obj.organisation_id,
        "BIRTHDAYS",
        true
      );
      if (birthdays) {
        if (birthdays[month_number] && birthdays[month_number].length > 0) {
          if (add) {
            birthdays[month_number].forEach((each_obj) => {
              if (each_obj.employee_id === obj.employee_id) {
                each_obj.first_name = obj.basic_info.first_name;
                each_obj.last_name = obj.basic_info.last_name;
                each_obj.date_of_birth = dob;
                each_obj.dp = obj.images && obj.images.dp ? obj.images.dp : "0";
              }
            });
            birthdays[month_number] = birthdays[month_number].push({
              employee_id: obj.employee_id,
              first_name: obj.basic_info.first_name,
              last_name: obj.basic_info.last_name,
              date_of_birth: dob,
              dp: obj.images && obj.images.dp ? obj.images.dp : "0",
            });
          } else {
            Object.keys(birthdays).forEach((month_number) => {
              birthdays[month_number] = birthdays[month_number].filter(
                (e) => e.employee_id !== obj.employee_id
              );
            });
            // await redis.redisInsert(
            //   obj.organisation_id,
            //   "BIRTHDAYS",
            //   JSON.stringify(birthdays)
            // );
            // return true;
          }
        } else {
          birthdays[month_number] = [
            {
              employee_id: obj.employee_id,
              first_name: obj.basic_info.first_name,
              last_name: obj.basic_info.last_name,
              date_of_birth: dob,
              dp: obj.images && obj.images.dp ? obj.images.dp : "0",
            },
          ];
        }
        await redis.redisInsert(
          obj.organisation_id,
          "BIRTHDAYS",
          JSON.stringify(birthdays)
        );
      } else {
        let birthdays = {};
        birthdays[month_number] = [
          {
            employee_id: obj.employee_id,
            first_name: obj.basic_info.first_name,
            last_name: obj.basic_info.last_name,
            date_of_birth: dob,
            dp: obj.images && obj.images.dp ? obj.images.dp : "0",
          },
        ];
        await redis.redisInsert(
          obj.organisation_id,
          "BIRTHDAYS",
          JSON.stringify(birthdays)
        );
      }
    }
    if (new_emp) {
      let emp_data = {
        employee_id: obj.employee_id,
        first_name: obj.basic_info.first_name,
        last_name: obj.basic_info.last_name,
        dp: obj.images && obj.images.dp ? obj.images.dp : "0",
        department_name: obj.work_info.department_name,
        role_name: obj.work_info.role_name,
        designation_name: obj.work_info.designation_name,
        date_of_join: obj.work_info.date_of_join,
      };
      let all_emps = await redis.redisGet(
        obj.organisation_id,
        "ALL_EMPS",
        true
      );
      if (all_emps) {
        all_emps.push(emp_data);
        await redis.redisInsert(
          obj.organisation_id,
          "ALL_EMPS",
          JSON.stringify(all_emps)
        );
        return true;
      } else {
        await redis.redisInsert(
          obj.organisation_id,
          "ALL_EMPS",
          JSON.stringify([emp_data])
        );
        return true;
      }
    }
    return true;
  },
};

async function recent_hires(organisation_id) {
  try {
    const today = new Date();
    const fifteenDaysAgo = new Date(today);
    fifteenDaysAgo.setDate(today.getDate() - 15);

    fifteenDaysAgo.setHours(0, 0, 0, 0);
    today.setHours(23, 59, 59, 999);

    // Find employees who joined within the last 15 days
    const recentHires = await mongoFunctions.find(
      "EMPLOYEE",
      {
        organisation_id: organisation_id,
        "work_info.date_of_join": {
          $gte: fifteenDaysAgo,
          $lte: today,
        },
      },
      { _id: -1 },
      {
        employee_id: 1,
        "basic_info.first_name": 1,
        "basic_info.last_name": 1,
        "basic_info.email": 1,
        "work_info.date_of_join": 1,
        "images.dp": 1,
      }
    );

    return recentHires;
  } catch (error) {
    console.error("Error fetching employees:", error);
    return [];
  }
}

async function employees_with_birthday_today(organisation_id) {
  try {
    const today = new Date();
    const currentMonth = today.getMonth() + 1; // 1-based month
    const currentDay = today.getDate();

    // Fetch all employees from the specified organisation
    const allEmployees = await mongoFunctions.find(
      "EMPLOYEE",
      {
        organisation_id: organisation_id,
        "personal_details.date_of_birth": { $exists: true }, // Ensure date_of_birth exists
      },
      { _id: -1 },
      {
        employee_id: 1,
        "basic_info.first_name": 1,
        "basic_info.last_name": 1,
        "basic_info.email": 1,
        "personal_details.date_of_birth": 1,
        "images.dp": 1,
      }
    );

    // Check if there are any employees
    if (allEmployees.length === 0) {
      console.log("No employees found.");
      return [];
    }

    // Filter employees whose birthday is today
    const employeesWithBirthday = allEmployees.filter((employee) => {
      const birthDate = new Date(employee.personal_details.date_of_birth);

      if (isNaN(birthDate.getTime())) {
        console.error(
          "Invalid birthDate:",
          employee.personal_details.date_of_birth
        );
        return false;
      }

      const birthMonth = birthDate.getMonth() + 1; // 1-based month
      const birthDay = birthDate.getDate();

      return birthMonth === currentMonth && birthDay === currentDay;
    });

    // console.log("Employees with birthday today:", employeesWithBirthday); // Debug: Print filtered results
    return employeesWithBirthday;
  } catch (error) {
    console.error("Error fetching employees:", error);
    return [];
  }
}

async function add_stats(employee_id, organisation_id, status) {
  // Define default status track
  const defaultStatusTrack = [
    { status: "new", count: 0 },
    { status: "in_progress", count: 0 },
    { status: "completed", count: 0 },
    { status: "under_review", count: 0 },
  ];

  // Check if the document exists
  const stat = await mongoFunctions.find_one("STATS", {
    employee_id: employee_id,
    organisation_id: organisation_id,
    createdAt: {
      $gte: new Date().setHours(0, 0, 0, 0),
      $lt: new Date().setHours(24, 0, 0, 0),
    },
  });

  if (!stat) {
    // Create a new record if the document was not found
    const statusTrack = defaultStatusTrack.map((st) => ({
      status: st.status,
      count: st.status === status ? 1 : 0, // Set count to 1 for the given status, 0 for others
    }));

    await mongoFunctions.create_new_record("STATS", {
      employee_id: employee_id,
      organisation_id: organisation_id, // Add createdAt to the new record
      status_track: statusTrack,
    });

    return { status: 200, message: "Status added as new record" };
  } else {
    // Document exists, attempt to update
    const result = await mongoFunctions.find_one_and_update(
      "STATS",
      {
        employee_id: employee_id,
        createdAt: {
          $gte: new Date().setHours(0, 0, 0, 0),
          $lt: new Date().setHours(24, 0, 0, 0),
        },
        "status_track.status": status,
      },
      {
        $inc: { "status_track.$[elem].count": 1 },
      },
      {
        arrayFilters: [{ "elem.status": status }], // Match status in the array
        returnDocument: "after", // Return the updated document
      }
    );
  }
}

async function update_stats(
  employee_id,
  organisation_id,
  prevStatus,
  currentStatus
) {
  const defaultStatusTrack = [
    { status: "new", count: 0 },
    { status: "in_progress", count: 0 },
    { status: "completed", count: 0 },
    { status: "under_review", count: 0 },
  ];

  // Get the start and end of the day
  const startOfDay = new Date().setHours(0, 0, 0, 0);
  const endOfDay = new Date().setHours(24, 0, 0, 0);

  // Check if the document exists
  const stat = await mongoFunctions.find_one("STATS", {
    employee_id: employee_id,
    organisation_id: organisation_id,
    createdAt: { $gte: startOfDay, $lt: endOfDay },
  });

  if (!stat) {
    // Create a new record if the document was not found
    const statusTrack = defaultStatusTrack.map((st) => ({
      status: st.status,
      count: st.status === currentStatus ? 1 : 0,
    }));

    await mongoFunctions.create_new_record("STATS", {
      employee_id: employee_id,
      organisation_id: organisation_id,
      createdAt: new Date(),
      status_track: statusTrack,
    });

    return { status: 200, message: "Status added as new record" };
  } else {
    // Update the existing record
    const result = await mongoFunctions.find_one_and_update(
      "STATS",
      {
        employee_id: employee_id,
        organisation_id: organisation_id,
        createdAt: { $gte: startOfDay, $lt: endOfDay },
      },
      {
        $inc: {
          "status_track.$[prev].count": prevStatus ? -1 : 0, // Decrement previous status count
          "status_track.$[curr].count": currentStatus ? 1 : 0, // Increment current status count
        },
      },
      {
        arrayFilters: [
          { "prev.status": prevStatus }, // Filter for the previous status
          { "curr.status": currentStatus }, // Filter for the current status
        ],
      }
    );

    return {
      status: 200,
      message: "Status updated successfully",
      data: result,
    };
  }
}
//calculate working minutes

async function calculate_working_minutes(attendance) {
  const { checkin, checkout, attendance_id } = attendance;

  if (checkin.length === checkout.length) {
    let totalTimeMinutes = 0;

    for (let i = 0; i < checkin.length; i++) {
      const checkinTime = checkin[i].in_time;
      const checkoutTime = checkout[i].out_time;
      console.log(checkinTime);
      console.log(checkoutTime);

      // Ensure both times are valid dates
      if (!isNaN(checkinTime) && !isNaN(checkoutTime)) {
        const diffInMs = checkoutTime - checkinTime;
        console.log("diffInMs--->", diffInMs);

        // Only add positive differences
        if (diffInMs > 0) {
          const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
          totalTimeMinutes += diffInMinutes;
        }
      }
    }

    console.log(totalTimeMinutes);
    let newStatus;
    if (totalTimeMinutes < 270) {
      // Less than 4.5 hours
      newStatus = "absent";
    } else if (totalTimeMinutes < 480) {
      // Less than 9 hours
      // If it is 4.5 hours or more but less than 9 hours
      newStatus = "half day";
    } else {
      // Greater than or equal to 9 hours
      newStatus = "present";
    }

    if (totalTimeMinutes >= 0) {
      await mongoFunctions.find_one_and_update(
        "ATTENDANCE",
        { attendance_id: attendance_id },
        {
          $set: {
            total_working_minutes: totalTimeMinutes,
            attendance_status: newStatus,
          },
        },
        { new: true } // This option returns the updated document
      );
    }

    return true;
  }
  return false;
}

// Helper function to parse dependent_details
function parseDependentDetails(details) {
  const regex =
    /name:\s*(.*?),\s*relation:\s*(.*?),\s*dependent_mobile_number:\s*(\d+)/g;
  const result = [];
  let match;

  while ((match = regex.exec(details)) !== null) {
    result.push({
      name: match[1].trim(),
      relation: match[2].trim(),
      dependent_mobile_number: match[3].trim(),
    });
  }
  return result;
}

// Helper function to parse educational_details
function parseEducationalDetails(details) {
  const regex =
    /degree:\s*(.*?),\s*specialization:\s*(.*?),\s*institute_name:\s*(.*?),\s*year_of_completion:\s*(\d{4})/;
  const match = regex.exec(details);
  if (match) {
    return {
      degree: match[1].trim(),
      specialization: match[2].trim(),
      institute_name: match[3].trim(),
      year_of_completion: match[4].trim(),
    };
  }
  return null;
}

// Helper function to parse work_experience
function parseWorkExperience(details) {
  const regex =
    /position:\s*(.*?),\s*company:\s*(.*?),\s*duration:\s*(.*?)(?=\s*position:|\s*$)/g;
  const result = [];
  let match;

  while ((match = regex.exec(details)) !== null) {
    result.push({
      position: match[1].trim(),
      company: match[2].trim(),
      duration: match[3].trim(),
    });
  }
  return result;
}

module.exports = {
  recent_hires,
  add_stats,
  update_stats,
  employees_with_birthday_today,
  calculate_working_minutes,
  parseDependentDetails,
  parseEducationalDetails,
  parseWorkExperience,
};
