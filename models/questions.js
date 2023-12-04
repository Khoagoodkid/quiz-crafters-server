const mongoose = require("mongoose")

const Schema = mongoose.Schema
const QuestionSchema = new Schema({
    query:String,
    choices: [{
        index:Number,
        text:String, 
        isCorrect: Boolean,

    }],  
    collectionId: String,
 
})
module.exports = mongoose.model("Questions", QuestionSchema)