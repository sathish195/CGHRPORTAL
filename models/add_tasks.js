const { required } = require("joi");
const mongoose = require("mongoose");

const Task_schema = new mongoose.Schema(
  {
    task_id: { type: String, required: true, unique: true, index: true },
    organisation_id: { type: String, required: true, index: true },
    project_id: { type: String, required: true, index: true },
    project_name: { type: String, required: true },
    department_id: { type: String, default: "" },
    employee_id: { type: String, default: "" },
    employee_name: { type: String, default: "" },
    status: { type: String, required: true },
    task_name: { type: String, required: true },
    description: { type: String, required: true },
    // start_date: {type: Date,required:false},
    // end_date: { type: Date,required:false},
    due_date: { type: Date, required: true },
    priority: { type: String, required: true },
    // status: { type: String, required: true },
    // team: { type: Array, required: true },
    task_status: { type: String, required: true },
    created_by: { type: Object, required: true },
    modified_by: { type: Array, required: true },
    completed_date: { type: Date, required: true, default: new Date() },
    assign_track: { type: Array, required: true },
    worked_hours: { type: Number, default: 0 },
    assigned_at: { type: Date, default: new Date() },
  },
  { timestamps: true }
);

Task_schema.index({ organisation_id: 1, task_id: 1 });
Task_schema.index({ organisation_id: 1, project_id: 1, task_id: 1 });

exports.TASKS = mongoose.model("TASKS", Task_schema);
