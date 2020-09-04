const mongoose = require("mongoose");
const cloudinary = require("cloudinary");
const Comment = require("./comment");
const User = require("./user");
const Vote = require("./vote");
const Subject = require("./subject");
const Notification = require("./notification");
const Follow = require("./follow");


const assignmentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: "Assignment title cannot be blank."
    }, //Title
    description: String, //Description
    author: {
        type: String,
        ref: "User",
        required: "Assignment author cannot be blank."
    }, //Author (User who created the Asignment)
    subject: {
        type: mongoose.Types.ObjectId,
        ref: "Subject",
        required: "Assignment must be on a subject."
    }, //Subject (The parent subject)
    score : {
        type: Number,
        default: 0
    }, //Score (Upvotes-Downvotes)
    slug: {
        type: String,
        unique: true
    }, //Slug
    tags: [
        {
            name: String
        }      
    ], //Tags
    attachments: [
        {
            url: String,
            id: String,
            name: String,
            mimetype: String
        }
    ] //Attachments
}, {
    timestamps: { type: Date, default: Date.now} //createdAt and updatedAt fields
});

assignmentSchema.set('toObject', { virtuals: true });
assignmentSchema.set('toJSON', { virtuals: true });

assignmentSchema.virtual('votes', {
    ref: 'Vote', 
    localField: '_id',
    foreignField: 'modelId',
    justOne: false,
    match: {modelName: "Assignment"}
});

assignmentSchema.virtual('comments', {
    ref: 'Comment', 
    localField: '_id',
    foreignField: 'modelId', 
    justOne: false,
    match: {modelName: "Assignment"}
});

assignmentSchema.virtual('notifications', {
    ref: 'Notification', 
    localField: '_id',
    foreignField: 'assignmentId', 
    justOne: false
});

//Add a slug before the assignment gets saved to the database
assignmentSchema.pre("save", async function (next) {
    try {
        //Check if a new assignment is being saved, or if the assignment title is being modified
        if (this.isNew || this.isModified("title")) {
            this.slug = await generateUniqueSlug(this._id, this.title);
        }
        return next();
    } catch (err) {
        //Handle error
        console.error(err);
        return next(err);
    }
});

assignmentSchema.pre("remove", async function(next) {
    try {
        //Check if assignment has attachments to remove
        if (this.attachments) {
            const removeAttachments = this.attachments;
            for (const attachment of removeAttachments) {
                await cloudinary.v2.uploader.destroy(attachment.id);
            }
        }
        const populated = await this.populate("comments votes notifications").execPopulate();
        
        //Remove comments on assignment
        const removeComments = populated.comments;
        for (const removeComment of removeComments) {
            await removeComment.remove();
        }

        //Remove all votes on assignment
        const removeVotes = populated.votes;
        for (const removeVote of removeVotes) {
            await removeVote.remove();
        }

        //Remove all notifications
        const removeNotifications = populated.notifications;
        for (const removeNotification of removeNotifications) {
            await removeNotification.remove();
        }
        
    } catch (err) {
        //Handle error
        console.error(err);
        return next(err);
    }
   
});


//#TODO: move this functions to utils (used on other models too)
async function generateUniqueSlug(id, assignmentTitle, slug, num) {
    try {
        //Generate the initial number
        if (!num) {
            num = 3;
        }
        //Generate the initial slug
        if (!slug) {
            slug = slugify(assignmentTitle, num);
        }
        //Check if a assignment with the slug already exists
        const assignment = await Assignment.findOne({slug: slug});
        //Check if a assignment was found or if the found assignment is the current assignment        
        if (!assignment || assignment._id == id) {
            return slug;
        }
        //If not unique, generate a new slug, increase random number digits
        const newSlug = slugify(assignmentTitle,num+1);
        //Check again by calling the function recursively
        return await generateUniqueSlug(id, assignmentTitle, newSlug, num+1);
    } catch (err) {
        throw new Error(err);
    }
}

function slugify(text, num) {
    const exp = Math.pow(10,num);
    const slug = text.toString().toLowerCase()
      .replace(/\s+/g, "-")        //Replace spaces with -
      .replace(/[^\w\-]+/g, "")    //Remove all non-word chars
      .replace(/\-\-+/g, "-")      //Replace multiple - with single -
      .replace(/^-+/, "")          //Trim - from start of text
      .replace(/-+$/, "")          //Trim - from end of text
      .substring(0, 75);           //Trim at 75 characters
    return slug + "-" + Math.floor(1*exp + Math.random() * 9*exp);  //Add random digits to improve uniqueness
}

const Assignment = mongoose.model("Assignment", assignmentSchema);

module.exports = Assignment;