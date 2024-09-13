const mongoFunctions = require("./mongoFunctions");
const mongofunctions = require("./mongoFunctions");
const redis = require("./redisFunctions");
const moment = require("moment");
const { employee_id } = require("./schema");

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
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-based month
    const currentDay = today.getDate();

    // Construct the start and end of the range for today's month and day
    const startOfDay = new Date(
      currentYear,
      currentMonth,
      currentDay,
      0,
      0,
      0,
      0
    );
    const endOfDay = new Date(
      currentYear,
      currentMonth,
      currentDay,
      23,
      59,
      59,
      999
    );

    // To match any year but the same month and day
    const employeesWithBirthday = await mongoFunctions.find(
      "EMPLOYEE",
      {
        organisation_id: organisation_id,
        "personal_details.date_of_birth": {
          $gte: startOfDay, // Start of the day
          $lte: endOfDay, // End of the day
        },
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

    console.log(employeesWithBirthday); // Debug: Print employees with birthday today
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
        $inc: { "status_track.$[elem].count": 1 }, // Increment the count field by 1 for the matched status
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

module.exports = {
  recent_hires,
  add_stats,
  update_stats,
  employees_with_birthday_today,
};
