const mongoose = require("mongoose");

// Define a schema for status tracking
// const statusSchema = new mongoose.Schema({
//     status_track: [{
//       status: {
//         type: String,
//         enum: ["new", "in_progress", "completed", "under_review"],
//         required: true
//       },
//       count: {
//         type: Number,
//         default: 0
//       }
//     }]
//   });
  

// Define default status values
const defaultStatusTrack = [
    { status: "new", count: 0 },
    { status: "in_progress", count: 0 },
    { status: "completed", count: 0 },
    { status: "under_review", count: 0 }
];

// Define the main schema
const statsSchema = new mongoose.Schema({
    organisation_id: { type: String, required: true },
    employee_id: { type: String, required: true },
    status_track: {
        type: Array,
        default: defaultStatusTrack
    }
}, { timestamps: true });

// Export the model
exports.STATS = mongoose.model("STATS", statsSchema);


//  if (stat.length === 0){
      //     await mongoFunctions.create_new_record("STATS",{employee_id:req.employee.employee_id,organisation_id:req.employee.organisation_id});
      //   }
      
      // const stats = await mongoFunctions.find_one_and_update(
      //   "STATS",
      //   {
      //     employee_id: req.employee.employee_id,
      //     createdAt: {
      //       $gte: new Date().setHours(0, 0, 0, 0),
      //       $lt: new Date().setHours(24, 0, 0, 0)
      //     }
      //   },
      //   {
      //     $inc: {
      //       "status_track.$[elem].count": 1  // Increment the count field by 1
      //     }
      //   },
      //   {
      //     arrayFilters: [
      //       { "elem.status": task_data_up.status }  // Match status in the array
      //     ],
      //     upsert: true,
      //     // returnDocument: "after"  // Optional: return the updated document
      //   }
      // );
      // console.log(stats);


      // const stat=await mongoFunctions.find_one("STATS",{"organisation_id":req.employee.organisation_id});
      // if (stat.length === 0){
      //   await mongoFunctions.create_new_record("STATS",{employee_id:req.employee.employee_id,organisation_id:req.employee.organisation_id,status_track:[]});
      // }else{
      // const statss = await mongoFunctions.find_one_and_update(
      //   "STATS",
      //   {
      //     employee_id: req.employee.employee_id,
      //     createdAt: {
      //       $gte: new Date().setHours(0, 0, 0, 0),
      //       $lt: new Date().setHours(24, 0, 0, 0)
      //     },
      //     "status_track.status": new_task_data.status
      //   },
      //   {
      //     $inc: {
      //       "status_track.$[elem].count": 1  // Increment the count field by 1
      //     }
      //   },
      //   {
      //     arrayFilters: [
      //       { "elem.status": new_task_data.status }  // Match status in the array
      //     ],
      //     upsert: true,
      //     // returnDocument: "after"  // Optional: return the updated document
      //   }
      // );
      
      // await mongoFunctions.create_new_record("STATS",{employee_id:req.employee.employee_id,organisation_id:req.employee.organisation_id});
      