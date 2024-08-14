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
    }
};

recent_hires: async (organisation_id) => {
    let all_emps = await redis.redisGet(organisation_id, "ALL_EMPS", true);
    if (all_emps) {
      const today = new Date();
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(today.getDate() - 15);
      all_emps.filter((e) => {
        const joining_date = new Date(e.date_of_join);
        return joining_date >= fifteenDaysAgo;
      });
    }
    return false;
  };