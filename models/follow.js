const mongoose = require("mongoose");
const User = require("./user");

const followSchema = new mongoose.Schema({
	follower: {
        type: String,
        ref: "User",
        required: "Follow must have a follower user."
    }, //Follower (User who follows the followed)
    followed: {
        type: String,
        ref: "User",
        required: "Follow must have a followed user."
    }, //Followed (User who is followed by the follower)
}, {
    timestamps: { type: Date, default: Date.now} //createdAt and updatedAt fields
});

const Follow = mongoose.model("Follow", followSchema);

module.exports = Follow;