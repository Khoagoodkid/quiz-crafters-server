const mongoose = require("mongoose")

const Schema = mongoose.Schema
const CreatorSchema = new Schema({
    email:String, 
    password: String
 
})
module.exports = mongoose.model("Creators", CreatorSchema)