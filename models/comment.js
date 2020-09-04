const mongoose = require("mongoose");
const Assignment = require("./assignment");
const User = require("./user");
const Vote = require("./vote");

const commentSchema = new mongoose.Schema({
    text: {
        type: String,
        required: "Comment text cannot be blank."
    }, //Text
    author: {
        type: String,
        ref: "User",
        required: "Comment author cannot be blank."
    }, //Author (User who created the Comment)
    modelId: {
        type: mongoose.Schema.Types.ObjectId,
        required: "Comment must be on something.",
        refPath: "modelName"
    }, //On (Where the comment was made)
    modelName: {
        type: String,
        required: "Comment must reference a model.",
        enum: ["Assignment","Comment"],
        default: "Assignment"
    }, //Model Name (What kind of model was voted)
    score : {
        type: Number,
        default: 0
    }, //Score (Upvotes-Downvotes)
}, {
    timestamps: { type: Date, default: Date.now} //createdAt and updatedAt fields
});

commentSchema.set('toObject', { virtuals: true });
commentSchema.set('toJSON', { virtuals: true });

commentSchema.virtual('replies', {
    ref: 'Comment', 
    localField: '_id', 
    foreignField: 'modelId', 
    justOne: false,
    match: {modelName: "Comment"}
});

commentSchema.virtual('votes', {
    ref: 'Vote', 
    localField: '_id', 
    foreignField: 'modelId', 
    justOne: false,
    match: {modelName: "Comment"}
});

commentSchema.pre("remove", async function(next) {
    try {
        //Populate fields
        const populated = await this.populate("replies votes").execPopulate();

        //Remove replies on comment
        const removeReplies = populated.replies;
        for (const removeReply of removeReplies) {
            await removeReply.remove();
        }

        //Remove all votes on comment
        const removeVotes = populated.votes;
        for (const removeVote of removeVotes) {            
            await removeVote.remove();
        }        
        
    } catch (err) {
        //Handle error
        console.error(err);
        return next(err);
    }
   
});

const Comment = mongoose.model("Comment", commentSchema);

module.exports = Comment;