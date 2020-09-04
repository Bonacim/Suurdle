const mongoose = require("mongoose");
const passportLocalMongoose  = require("passport-local-mongoose");
const cloudinary = require("cloudinary");
const Comment = require("./comment");
const Assignment = require("./assignment");
const Vote = require("./vote");
const Notification = require("./notification");
const Follow = require("./follow");

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        unique: true,
        index: true,
        required: "Username cannot be blank."
    }, //Username
    password: {
        type: String,
        //required: "Password cannot be blank." //Doesn't work with authenticate
    }, //Password
    email: {
        type: String,
        unique: true,
        index: true,
        required: "Email cannot be blank."
    }, //Email
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    avatar: {
        url: String,
        id: String,
    }, //Avatar
    firstName: {
        type: String,
        required: "First name cannot be blank."
    }, //First name
    lastName: {
        type: String,
        required: "Last name cannot be blank."
    }, //Last Name
    isAdmin: {type: Boolean, default: false} //IsAdmin (Is User an Admin?)
}, {
    timestamps: { type: Date, default: Date.now} //createdAt and updatedAt fields
});
//#TODO: add point system to user

userSchema.set('toObject', { virtuals: true });
userSchema.set('toJSON', { virtuals: true });

userSchema.virtual('assignments', {
    ref: 'Assignment', 
    localField: 'username',
    foreignField: 'author', 
    justOne: false
});

userSchema.virtual('comments', {
    ref: 'Comment', 
    localField: 'username',
    foreignField: 'author', 
    justOne: false,
    match: {modelName: "Assignment"}
});

userSchema.virtual('replies', {
    ref: 'Comment', 
    localField: 'username', 
    foreignField: 'author', 
    justOne: false,
    match: {modelName: "Comment"}
});

userSchema.virtual('votes', {
    ref: 'Vote', 
    localField: 'username', 
    foreignField: 'user',
    justOne: false
});

userSchema.virtual('notifications', {
    ref: 'Notification', 
    localField: 'username', 
    foreignField: 'receiver',
    justOne: false
});

userSchema.virtual('followers', {
    ref: 'Follow', 
    localField: 'username', 
    foreignField: 'followed',
    justOne: false,
    options: {select: "follower -followed"}
});

userSchema.virtual('following', {
    ref: 'Follow', 
    localField: 'username', 
    foreignField: 'follower',
    justOne: false,
    options: {select: "followed -follower"}
});

//Plugin for authentication
userSchema.plugin(passportLocalMongoose);

userSchema.post("save", function(err, doc, next) {
    //Handle error
    if (err.name === "MongoError" && err.code === 11000) {
        return next(new Error("Email already registered"));
    }
    console.error(err)
    return next(err);
});

userSchema.pre("remove", async function(next){
    try {
        //Delete custom avatar
        if (this.avatar.id) {
            await cloudinary.v2.uploader.destroy(this.avatar.id);
        }

        const populated = await this.populate("votes assignments notifications followers following").execPopulate();

        //Remove all votes on assignments made by the user
        const removeVotes = populated.votes;
        for (const removeVote of removeVotes) {            
            await removeVote.remove();
        }
        
        //Remove all assignments made by the user
        const removeAssignments = populated.assignments;
        for (const removeAssignment of removeAssignments) {            
            await removeAssignment.remove();
        }

        //Remove all the comments/replies made by the user
        const removeComments = await Comment.find({"author": this.username});//Gets all comments and replies in one query
        for (const removeComment of removeComments) {            
            await removeComment.remove();
        }

        //Remove all notifications for the user
        const removeNotifications = populated.notifications;
        for (const removeNotification of removeNotifications) {            
            await removeNotification.remove();
        }

        //Remove all follow relationships
        const removeFollowings = populated.following;
        for (const removeFollowing of removeFollowings) {            
            await removeFollowing.remove();
        }
        
        const removeFollowers = populated.followers;
        for (const removeFollower of removeFollowers) {            
            await removeFollower.remove();
        }

    } catch (err) {
        //Handle error
        console.error(err);
        return next(err);
    }
});

const User = mongoose.model("User", userSchema);

module.exports = User;