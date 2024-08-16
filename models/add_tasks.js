const mongoose = require("mongoose");

const Task_schema=new mongoose.Schema({
    task_id: { type: String, required: true, unique: true },
    task_name: { type: String, required: true },
    description: { type: String, required: true },
    deadline: {type:String, required: true },
    status: { type: String, required: true },
    assignee:{ type: Array, required: true },
    created_by:{ type: String, required: true },
    modified_by:{ type: String, required: true },

},
{ timestamps: true }
);

exports.TASKS= mongoose.model("TASKS", Task_schema);


const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    projectId: { type: String, required: true },
    projectName: { type: String, required: true },
    projectStatus: { type: String, required: true },
    taskId: { type: String, required: true },
    taskName: { type: String, required: true },
    deadline: { type: Date, required: true },
    status: { type: String, enum: { values: ["NEW", "PROGRESS", "HOLD", "REVIEW", "COMPLETED"] }, default: "NEW" },
    taskStatus: { type: String, enum: { values: ["ACTIVE", "TERMINATED"] }, default: "ACTIVE" },
    createdBy: {
        employeeId: { type: String },
        employeeName: { type: String },
        dateTime: { type: String }
    },
    assignTrack: [
        {
            trackId: { type: String, unique: true },
            assignedBy: {
                employeeId: { type: String },
                employeeName: { type: String },
                dateTime: { type: String }
            },
            assignedTo: {
                employeeId: { type: String },
                employeeName: { type: String },
                dateTime: { type: String },
                statusTrack: [
                    {
                        prevStatus: { type: String },
                        newStatus: { type: String },
                        dateTime: { type: Date },
                        modifiedBy: {
                            employeeId: { type: String },
                            employeeName: { type: String },
                        }
                    }
                ],
            },
        }
    ],
    currentTrack: { type: String, required: true },
    startDate: { type: Date },
    endDate: { type: Date },
    totalDays: { type: Number },
    completedDate: { type: Date }
})