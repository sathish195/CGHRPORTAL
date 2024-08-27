const mongoFunctions = require("./mongoFunctions");
const mongofunctions = require("./mongoFunctions");
const redis = require("./redisFunctions");
const moment = require("moment");

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
      // Assuming mongoFunctions.find is an async function
      const all_emps = await mongoFunctions.find("EMPLOYEE", { organisation_id :organisation_id});
  
      if (all_emps) {
        const today = new Date();
        const fifteenDaysAgo = new Date(today);
        fifteenDaysAgo.setDate(today.getDate() - 15);
  
        // Filter employees directly in the database query for efficiency
        const recentHires = await mongoFunctions.find(
          "EMPLOYEE",
          {
            organisation_id:organisation_id,
            "work_info.date_of_join": { $gte: fifteenDaysAgo },
          }
        );
        console.log(recentHires);
        return recentHires;
      }
  
      return [];
    } catch (error) {
      console.error("Error fetching employees:", error);
      return [];
    }
  }
  async function add_stats(employee_id, organisation_id, status) {
    // Check if the document exists
    const stat = await mongoFunctions.find_one("STATS", { "organisation_id": organisation_id });
    const defaultStatusTrack = [
      { status: "new", count: 0 },
      { status: "in_progress", count: 0 },
      { status: "completed", count: 0 },
      { status: "under_review", count: 0 }
  ];
  
    if (!stat) {
      // Create a new record if the document was not found
      await mongoFunctions.create_new_record("STATS", {
        employee_id: employee_id,
        organisation_id: organisation_id,
        status_track: defaultStatusTrack.map(st => ({
          status: st,
          count: st === status ? 1 : 0  // Initialize the count to 1 for the provided status, 0 for others
        }))
      });
      return { status: 200, message: "Status added as new record" };
    }
  
    // Attempt to update the document
    const result = await mongoFunctions.find_one_and_update(
      "STATS",
      {
        employee_id: employee_id,
        createdAt: {
          $gte: new Date().setHours(0, 0, 0, 0),
          $lt: new Date().setHours(24, 0, 0, 0)
        },
        "status_track.status": status
      },
      {
        $inc: { "status_track.$[elem].count": 1 }  // Increment the count field by 1
      },
      {
        arrayFilters: [{ "elem.status": status }],  // Match status in the array
        // upsert: true,  // Create the document if it doesn’t exist
        // returnDocument: "after"  // Return the updated document
      }
    );
  
    // Check if the document was updated or not
    if (!result) {
      // Create a new record if the document was not found or not updated
      await mongoFunctions.create_new_record("STATS", {
        employee_id: employee_id,
        organisation_id: organisation_id,
        status_track: defaultStatusTrack.map(st => ({
          status: st,
          count: st === status ? 1 : 0  // Initialize the count to 1 for the provided status, 0 for others
        })) // Initialize with the status and count
      });
      return { status: 200, message: "Status added as new record" };
    }
  
    // Return the updated document
    // return { status: 200, data: result.value };
  }
      
  module.exports={recent_hires,add_stats};

