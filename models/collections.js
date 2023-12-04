const mongoose = require("mongoose")

const Schema = mongoose.Schema
const CollectionSchema = new Schema({
    name:String,
    userId:String
 
})
module.exports = mongoose.model("Collections", CollectionSchema)