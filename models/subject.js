const mongoose = require("mongoose");
const Assignment = require("./assignment");
const User = require("./user");
const Domain = require("./domain");

const subjectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: "Subject name cannot be blank."
    }, //Name
    creator: {
        type: mongoose.Types.ObjectId,
        ref: "User",
        required: "Subject creator cannot be blank."
    }, //Creator (User who created the Subject) 
    domain: {
        type: mongoose.Types.ObjectId,
        ref: "Domain",
        required: "Subject must be on a domain."
    }, //Domain (The parent domain)
    slug: {
        type: String,
        unique: true
    }, //Slug
    referTo: String, //Refer To (External url that helps verify the Subject)
    verified: {type: Boolean, default: false} //Verified
}, {
    timestamps: { type: Date, default: Date.now} //createdAt and updatedAt fields
});
//creator and referTo should only be used by admin/mods to help retrieve data about the subject

subjectSchema.set('toObject', { virtuals: true });
subjectSchema.set('toJSON', { virtuals: true });

subjectSchema.virtual('assignments', {
    ref: 'Assignment', 
    localField: '_id',
    foreignField: 'subject', 
    justOne: false
});

subjectSchema.virtual('countAssignments', {
    ref: 'Assignment', 
    localField: '_id',
    foreignField: 'subject', 
    count: true
});

//Add a slug before the subject gets saved to the database
subjectSchema.pre("save", async function (next) {
    try {
        //Check if a new subject is being saved, or if the subject name is being modified
        if (this.isNew || this.isModified("name")) {
            this.slug = await generateUniqueSlug(this._id, this.name);
        }
        return next();
    } catch (err) {
        //Handle error
        console.error(err);
        return next(err);
    }
});

subjectSchema.pre("remove", async function(next) {
    try {
        const populated = await this.populate("assignments").execPopulate();
        
        //Remove comments on assignment
        const removeAssignments = populated.assignments;
        for (const removeAssignment of removeAssignments) {
            await removeAssignment.remove();
        }
        
    } catch (err) {
        //Handle error
        console.error(err);
        return next(err);
    }
});

async function generateUniqueSlug(id, subjectTitle, slug, num) {
    try {
        //Generate the initial number
        if (!num) {
            num = 3;
        }
        //Generate the initial slug
        if (!slug) {
            slug = slugify(subjectTitle, num);
        }
        //Check if a subject with the slug already exists
        const subject = await Subject.findOne({slug: slug});
        //Check if a subject was found or if the found subject is the current subject        
        if (!subject || subject._id == id) {
            return slug;
        }
        //If not unique, generate a new slug, increase random number digits
        const newSlug = slugify(subjectTitle,num+1);
        //Check again by calling the function recursively
        return await generateUniqueSlug(id, subjectTitle, newSlug, num+1);
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

const Subject = mongoose.model("Subject", subjectSchema);

module.exports = Subject;