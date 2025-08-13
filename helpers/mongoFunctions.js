const { EMPLOYEE } = require("../models/add_employee");
const { ORGANISATIONS } = require("../models/add_org");
const { PROJECTS } = require("../models/add_projects");
const { TASKS } = require("../models/add_tasks");
const { STATS } = require("../models/add_stats");
const { LEAVE } = require("../models/add_leaves");
const { ATTENDANCE } = require("../models/add_attendance");
const { HOLIDAYS } = require("../models/add_holiday");
const { SUPER_ADMIN } = require("../models/add_super_admin");
const { ADMIN_CONTROLS } = require("../models/add_admin_controls");
const { ADMIN_STATS } = require("../models/stats");
const { EVENTS } = require("../models/add_events");
const { LEADS } = require("../models/leads");
const { POSTINGS } = require("../models/postings");
const { TEMPLATES } = require("../models/templates");
const { EMAILS } = require("../models/emails");
const { NOTIFICATIONS } = require("../models/notifications");
const { LISTINGS } = require("../models/listings");
const { ACCESS_CONTROLS } = require("../models/access_controls");
const { ORG_LEVEL_CONTROLS } = require("../models/org_level_controls");

const fs = require("fs");
const path = require("path");
const { alertDev } = require("./telegram");

module.exports = {
  create_new_record: async (collection, data) => {
    try {
      var new_record = await eval(collection);
      var new_record = await new new_record(data);
      return await new_record.save();
    } catch (error) {
      throw new Error(
        `❌❌❌❌ err in create new record mongo query \n ${error} \n ❌❌❌❌`
      );
    }
  },
  insert_many_records: async (collection, dataArray) => {
    try {
      const Model = eval(collection);
      return await Model.insertMany(dataArray);
    } catch (error) {
      throw new Error(
        `❌❌❌❌ Error in insert many records Mongo query \n ${error} \n ❌❌❌❌`
      );
    }
  },
  find_with_projection: async (
    collection,
    condition,
    projection,
    sort,
    select,
    limit,
    skip
  ) => {
    return await eval(collection)
      .find(condition, projection)
      .select(select)
      .sort(sort)
      .limit(limit)
      .skip(skip);
  },
  find: async (collection, condition, sort, select, limit) => {
    return await eval(collection)
      .find(condition)
      .select(select)
      .sort(sort)
      .limit(limit)
      .lean();
  },
  find_one: async (collection, condition, select, sort) => {
    return await eval(collection)
      .findOne(condition)
      .select(select)
      .sort(sort)
      .lean();
  },
  find_one_and_update: async (collection, condition, update, options) => {
    if (!options) {
      options = { new: true };
    }
    return await eval(collection).findOneAndUpdate(condition, update, options);
  },
  find_one_and_delete: async (collection, condition, options) => {
    return await eval(collection).findOneAndDelete(condition, options);
  },
  find_one_and_remove: async (collection, condition, options) => {
    return await eval(collection).findOneAndRemove(condition, options);
  },
  find_one_and_replace: async (collection, condition, update, options) => {
    return await eval(collection).findOneAndReplace(condition, update, options);
  },
  update_many: async (collection, condition, update, options) => {
    return await eval(collection).updateMany(condition, update, options);
  },
  delete_many: async (collection, condition) => {
    return await eval(collection).deleteMany(condition, { mutli: true });
  },
  delete_one: async (collection, condition) => {
    return await eval(collection).deleteOne(condition);
  },
  replace_one: async (collection, condition, update) => {
    return await eval(collection).replaceOne(condition, update);
  },

  update_one: async (collection, condition, update, options = {}) => {
    return await eval(collection).updateOne(condition, update, options);
  },
  lazy_loading: async (collection, condition, select, sort, limit, skip) => {
    return await eval(collection)
      .find(condition)
      .select(select)
      .sort(sort)
      .limit(limit)
      .skip(skip)
      .lean();
  },
  lazy_loading_test: async (
    collection,
    condition,
    select,
    sort,
    skip,
    limit
    // batchSize
  ) => {
    return (
      eval(collection)
        .find(condition)
        .select(select)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        // .batchSize(batchSize)
        .lean()
        .cursor()
    ); // returns a streaming cursor
  },

  aggregate: async (collection, pipeline) => {
    return await eval(collection).aggregate(pipeline);
  },
  count_documents: async (collection, condition = {}) => {
    return await eval(collection).countDocuments(condition);
  },
  distinct: async (collection, field, condition = {}) => {
    return await eval(collection).distinct(field, condition);
  },

  download_collection: async (collection) => {
    return await eval(collection)
      .find({})
      .lean()
      .then((docs) => {
        const jsonData = JSON.stringify(docs);
        var dirname = process.cwd() + "/dump/";
        if (!fs.existsSync(dirname)) {
          fs.mkdir(dirname, (res) => console.log("res else", res));
        }
        fs.writeFile(
          process.cwd() + `/dump/${collection}_dump.json`,
          jsonData,
          (err) => {
            if (err) {
              alertDev(
                `:x::x::x::x: err in download mongodb collection \n ${err} \n :x::x::x::x:`
              );
            }
            // console.log("Dump saved!");
            return "Dump_saved";
          }
        );
      })
      .catch((err) => {
        alertDev(
          `:x::x::x::x: err in download mongo query \n ${err} \n :x::x::x::x:`
        );
      });
  },
};
