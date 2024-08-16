const { date } = require("joi");
const mongoose = require("mongoose");

const Project_schema=new mongoose.Schema({
    project_id: { type: String, required: true, unique: true },
    project_name: { type: String, required: true },
    description: { type: String, required: true },
    start_date: { type: date, required: true },
    end_date: { type: date, required: true },
    status: { type: String, required: true },
    team: { type: Array, required: true },
    project_status: { type: String, required: true},
    created_by:{ type: String, required: true },
    modified_by:{ type: String, required: true },


},
{ timestamps: true }
);

exports.PROJECTS= mongoose.model("PROJECTS", Project_schema);