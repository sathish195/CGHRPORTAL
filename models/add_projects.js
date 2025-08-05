const mongoose = require("mongoose");

const Project_schema = new mongoose.Schema(
  {
    organisation_id: { type: String, required: true, index: true },
    project_id: { type: String, required: true, unique: true, index: true },
    project_name: { type: String, required: true },
    // email: { type: String, required: true },
    comments: { type: String, default: "" },
    description: { type: String, required: true },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    status: { type: String, required: true },
    team: { type: Array, required: true },
    project_status: { type: String, required: true },
    created_by: { type: Object, required: true },
    modified_by: { type: Array, required: true },
    assign_track: { type: Array, required: true },
    attachments: { type: Array, default: [] },
  },
  { timestamps: true }
);
Project_schema.index({ organisation_id: 1, project_id: 1 });

exports.PROJECTS = mongoose.model("PROJECTS", Project_schema);
