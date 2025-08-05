var RedisClient = require("redis");
const mongofunctions = require("./mongoFunctions");
let client;
const { alertDev } = require("./telegram");

if (process.env.REDIS_URL) {
  client = RedisClient.createClient({
    url: `redis://${process.env.REDIS_URL}:${process.env.REDIS_PORT}`,
    password: process.env.REDIS_PASSWORD,
  });
}
// alertDev(process.env.REDIS_URL);

client.on("error", (err) => {
  console.log("redis err--->", err);
});
client.on("connect", (connect) => {
  console.log("redis 🧨 connected");
});
client.connect();

module.exports = {
  //----------------custom redis functions----------
  update_redis: async (COLLECTION, obj, from_mongo = false, key = false) => {
    if (from_mongo && key) {
      find_user = await mongofunctions.find_one(COLLECTION, {
        [key]: obj[key],
      });
      if (find_user) {
        obj = find_user;
      } else {
      }
    }
    if (COLLECTION === "ADMIN") {
      obj.password = undefined;
      obj.two_fa_key = undefined;
      obj._id = undefined;
      obj.__v = undefined;
      obj.fcm_token = undefined;
      obj.others = undefined;
      obj.updatedAt = undefined;
      obj.browser_id = undefined;
      await client.hSet(
        "CRM_ADMIN",
        obj.userid,
        JSON.stringify(obj),
        (err, res) => {}
      );
      return true;
    } else if (COLLECTION === "ADMIN_CONTROLS") {
      obj._id = undefined;
      obj.__v = undefined;
      obj.createdAt = undefined;
      obj.updatedAt = undefined;
      await client.hSet(
        "CGHR_ADMIN_CONTROLS",
        "ADMIN_CONTROLS",
        JSON.stringify(obj),
        (err, res) => {}
      );
      return true;
    } else if (COLLECTION === "ADMIN_STATS") {
      obj._id = undefined;
      obj.__v = undefined;
      obj.createdAt = undefined;
      obj.updatedAt = undefined;
      await client.hSet(
        "CGHR_ADMIN_STATS",
        "ADMIN_STATS",
        JSON.stringify(obj),
        (err, res) => {}
      );
      return true;
    } else if (COLLECTION === "SUPER_ADMIN") {
      obj._id = undefined;
      obj.__v = undefined;
      obj.createdAt = undefined;
      obj.updatedAt = undefined;
      await client.hSet(
        "CG_SUPER_ADMIN",
        obj.email,
        JSON.stringify(obj),
        (err, res) => {}
      );
      return true;
    } else if (COLLECTION === "USER") {
      obj._id = undefined;
      obj.__v = undefined;
      obj.createdAt = undefined;
      obj.updatedAt = undefined;
      obj.two_fa_key = undefined;
      obj.two_fa_status = undefined;
      obj.others = undefined;
      await client.hSet(
        "CRM_USER",
        obj.userid,
        JSON.stringify(obj),
        (err, res) => {}
      );
      return true;
    } else if (COLLECTION === "ORGANISATIONS") {
      obj._id = undefined;
      obj.__v = undefined;
      obj.createdAt = undefined;
      obj.updatedAt = undefined;
      await client.hSet(
        "CRM_ORGANISATIONS",
        obj.organisation_id,
        JSON.stringify(obj),
        (err, res) => {}
      );
      return true;
    } else if (COLLECTION === "EMPLOYEE") {
      obj._id = undefined;
      obj.__v = undefined;
      obj.images = undefined;
      // obj.createdAt = undefined;
      obj.updatedAt = undefined;
      await client.hSet(
        obj.organisation_id,
        obj.employee_id,
        JSON.stringify(obj),
        (err, res) => {}
      );
      return true;
    }
  },

  genOtp: async (key, value, expire) => {
    await client.setEx(key, expire, value.toString(), (err, res) => {});
  },

  with_expire: async (hash, key, data, expirationInSeconds, parse = true) => {
    if (parse) {
      data = JSON.stringify(data);
    }

    client.hSet(hash, key, data, (err, reply) => {
      if (err) {
        console.error("Error setting hash field:", err);
        return err;
      }
      client.expire(
        `${hash} ${key}`,
        expirationInSeconds,
        (expireErr, expireReply) => {
          if (expireErr) {
            console.error("Error setting expiration:", expireErr);
            return err;
          }
        }
      );
    });
  },
  //-----------------redis functions------------------
  redisGet: async (hash, key, parse = false) => {
    let check_exists = await client.hExists(hash, key);
    if (check_exists) {
      var value = await client.hmGet(hash, key);
      if (value) {
        if (parse) {
          value = JSON.parse(value);
        }
        return value;
      } else {
        return false;
      }
    } else {
      return false;
    }
  },

  redisGetSingle: async (key, parse = false) => {
    let check_exists = await client.exists(key);
    if (check_exists) {
      var value = await client.get(key);
      if (value) {
        if (parse) {
          value = JSON.parse(value);
        }
        return value;
      }
      return false;
    }
    return false;
  },
  redisGetAll: async (key, parse = false) => {
    let check_exists = await client.exists(key);
    if (check_exists) {
      var value = await client.hGetAll(key);
      if (value) {
        if (parse) {
          let value_o = Object.values(value);
          value = JSON.parse(value_o);
        }
        return value;
      }
      return false;
    }
    return false;
  },

  redisSetSingle: async (hash, data, parse = false) => {
    if (parse) {
      data = JSON.stringify(data);
    }
    var dta = await client.set(hash, data);
    return dta;
  },

  redisInsert: async (hash, key, data, parse = false) => {
    try {
      if (parse) {
        data = JSON.stringify(data);
      }
      return await client.hSet(hash, key, data);
    } catch (err) {
      console.log("err in redis insert", err);
    }
  },
  redisHdelete: async (hash, key) => {
    var dta = await client.hDel(hash, key);
    return dta;
  },
  redisDelete: async (key) => {
    var dta = await client.del(key);
    return dta;
  },
  add_task_status: async (employee_id, current_status) => {
    try {
      const key = employee_id;

      // Check if the task already exists in Redis
      const exists = await client.exists(key);

      if (!exists) {
        // Initialize status counts
        const initial_status_counts = {
          new: 0,
          in_progress: 0,
          under_review: 0,
          completed: 0,
          hold: 0,
        };

        // Increment the count for the current status
        initial_status_counts[current_status] = 1;

        // Store the object in Redis
        await client.hSet(key, initial_status_counts);
      } else {
        await client.hIncrBy(key, current_status, 1); // Increment current status
      }

      // Retrieve the updated status counts for verification
      // const updatedStatusCounts = await client.hGetAll(key);
    } catch (error) {
      console.error("Error managing task status:", error.message);
    }
  },
  remove_task_status: async (employee_id, current_status) => {
    try {
      const key = employee_id;

      // Check if the task already exists in Redis
      const exists = await client.exists(key);

      if (!exists) {
      } else {
        await client.hIncrBy(key, current_status, -1); // Decrement current status
      }

      // Retrieve the updated status counts for verification
      // const updatedStatusCounts = await client.hGetAll(key);
      
    } catch (error) {
      console.error("Error managing task status:", error.message);
    }
  },
  update_task_status: async (employee_id, current_status, prev_status) => {
    try {
      const key = employee_id;

      const exists = await client.exists(key);

      if (!exists) {
        // Initialize status counts
        const initial_status_counts = {
          new: 0,
          in_progress: 0,
          under_review: 0,
          completed: 0,
          hold: 0,
        };

        // Increment the count for the current status
        initial_status_counts[current_status] = 1;

        // Store the object in Redis
        await client.hSet(key, initial_status_counts);
      } else {
        await client.hIncrBy(key, prev_status, -1); // Decrement previous status

        await client.hIncrBy(key, current_status, 1); // Increment current status

      }

      // Retrieve the updated status counts for verification
      // const updatedStatusCounts = await client.hGetAll(key);
      
    } catch (error) {
      console.error("Error managing task status:", error.message);
    }
  },
  del_task_status: async (employee_id, current_status = null) => {
    try {
      const key = employee_id;

      // Check if the task exists in Redis
      const exists = await client.exists(key);

      if (!exists) {
       
        return;
      }

      if (current_status) {
        // Remove specific status from the hash
        const removed = await client.hDel(key, current_status);
        if (removed) {
          
        } else {
          
        }
      } else {
        // Delete the entire hash
        await client.del(key);
        
      }
    } catch (error) {
      console.error("Error removing task status:", error.message);
    }
  },
};
