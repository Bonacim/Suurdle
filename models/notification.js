const mongoose = require("mongoose");
const Assignment = require("./assignment");
const User = require("./user");

const notificationSchema = new mongoose.Schema({
	sender: {
        type: String,
        ref: "User",
        required: "Notification must have a sending user."
    }, //Sender (User who generated the notification)
    receiver: {
        type: String,
        ref: "User",
        required: "Notification must have a receiving user."
    }, //Receiver (User who the notification is for)
	assignmentId: {
        type: mongoose.Types.ObjectId,
        ref: "Assignment",
        required: "Notification must have a triggering event."
    }, //AssignmentId (Which assignment the notification is about)
	isRead: { type: Boolean, default: false } //IsRead (Has the receiver read?)
}, {
    timestamps: { type: Date, default: Date.now} //createdAt and updatedAt fields
});
//#TODO: assignmentId as ObjectId
//#TODO: notifications for other actions

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;