const mongoose = require("mongoose");
 
const voteSchema = new mongoose.Schema({
    user: {
        type: String,
        required: "Voting user cannot be blank."
    }, //Author (User who created the Comment)
    modelId: {
        type: mongoose.Schema.Types.ObjectId,
        required: "Vote must be on something.",
        refPath: "modelName"
    }, //Model ID (What was voted)
    modelName: {
        type: String,
        required: "Vote must reference a model.",
        enum: ["Assignment","Comment"],
        default: "Assignment"
    },//Model Name (What kind of model was voted)
    upvote: {
        type: Boolean,
        default: true
    },//Upvote (If it's a like or dislike)
}, {
    timestamps: { type: Date, default: Date.now} //createdAt and updatedAt fields
});

const Vote = mongoose.model("Vote", voteSchema);

module.exports = Vote;