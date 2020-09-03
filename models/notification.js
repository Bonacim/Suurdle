const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
	username: {
        type: String,
        required: "Notification must have a triggering user."
    }, //Username (Who the notification is about, not the receiver)
	assignmentId: {
        type: String,
        required: "Notification must have a triggering event."
    }, //AssignmentId (Which assignment the notification is about)
	isRead: { type: Boolean, default: false } //IsRead (Has the receiver read?)
}, {
    timestamps: { type: Date, default: Date.now} //createdAt and updatedAt fields
});
//#TODO: use ref on User:Notification (1:N) and Assigment:Notification (1:N)
//#TODO: assignmentId as ObjectId
//#TODO: notifications for other actions


module.exports = mongoose.model("Notification", notificationSchema);