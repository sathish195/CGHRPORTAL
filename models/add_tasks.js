
const mongoose = require("mongoose");

const Task_schema=new mongoose.Schema({
    task_id: { type: String, required: true, unique: true },
    organisation_id:{ type: String, required: true},
    project_id: { type: String, required: true },
    project_name:{ type: String, required: true},
    status: { type: String, required: true },
    task_name: { type: String, required: true },
    description: { type: String, required: true },
    // start_date: {type: Date,required:false},
    // end_date: { type: Date,required:false},
    due_date:{ type: Date, required: true},
    priority: { type: String, required: true },
    status: { type: String, required: true },
    team:{ type: Array, required: true },
    task_status: { type: String, required: true },
    created_by:{ type: Object, required: true },
    modified_by:{ type: Array, required: true },
    completed_date:{ type: Date, required: true,default: new Date()},
    assign_track: { type: Array, required: true },
                

},
{ timestamps: true }
);

exports.TASKS= mongoose.model("TASKS", Task_schema);

// {
//     "task_name":"CG-HR" ,
//     "description": "It is a hr Portal to track organisation details and employee working status and files",
//     "start_date":"2024-08-01",
//     "end_date":"2024-08-20",
//     "status": "under_review",
//     "task_status":"active" ,
//     "project_id":"PR7CE7BB42" ,
//     "task_id":""
//  }

// const mongoose = require('mongoose');

// const taskSchema = new mongoose.Schema({
//     projectId: { type: String, required: true },
//     projectName: { type: String, required: true },
//     projectStatus: { type: String, required: true },
//     taskId: { type: String, required: true },
//     taskName: { type: String, required: true },
//     deadline: { type: Date, required: true },
//     status: { type: String, enum: { values: ["NEW", "PROGRESS", "HOLD", "REVIEW", "COMPLETED"] }, default: "NEW" },
//     taskStatus: { type: String, enum: { values: ["ACTIVE", "TERMINATED"] }, default: "ACTIVE" },
//     createdBy: {
//         employeeId: { type: String },
//         employeeName: { type: String },
//         dateTime: { type: String }
//     },
//     assignTrack: [
//         {
//             trackId: { type: String, unique: true },
//             assignedBy: {
//                 employeeId: { type: String },
//                 employeeName: { type: String },
//                 dateTime: { type: String }
//             },
//             assignedTo: {
//                 employeeId: { type: String },
//                 employeeName: { type: String },
//                 dateTime: { type: String },
//                 statusTrack: [
//                     {
//                         prevStatus: { type: String },
//                         newStatus: { type: String },
//                         dateTime: { type: Date },
//                         modifiedBy: {
//                             employeeId: { type: String },
//                             employeeName: { type: String },
//                         }
//                     }
//                 ],
//             },
//         }
//     ],
//     currentTrack: { type: String, required: true },
//     startDate: { type: Date },
//     endDate: { type: Date },
//     totalDays: { type: Number },
//     completedDate: { type: Date }
// })