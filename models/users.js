const mongoose = require("mongoose")

const Schema = mongoose.Schema
const UserSchema = new Schema({
    name:String,
    points: Number,  
    socketId: String,
    roomId: String 
})
module.exports = mongoose.model("Users", UserSchema)