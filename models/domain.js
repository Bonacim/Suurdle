const mongoose = require("mongoose");
 
const domainSchema = new mongoose.Schema({
    name: {
        type: String,
        required: "Domain name cannot be blank."
    }, //Name
    creator: {
        type: mongoose.Types.ObjectId,
        required: "Domain creator cannot be blank."
    }, //Creator (User who created the Domain) 
    slug: {
        type: String,
        unique: true
    }, //Slug
    referTo: String, //Refer To (External url that helps verify the Domain)
    verified: {type: Boolean, default: false} //Verified
}, {
    timestamps: { type: Date, default: Date.now} //createdAt and updatedAt fields
});
//creator and referTo should only be used by admin/mods to help retrieve data about the domain

domainSchema.set('toObject', { virtuals: true });
domainSchema.set('toJSON', { virtuals: true });

domainSchema.virtual('subjects', {
    ref: 'Subject', 
    localField: '_id',
    foreignField: 'domain', 
    justOne: false
});

domainSchema.virtual('countSubjects', {
    ref: 'Subject', 
    localField: '_id',
    foreignField: 'domain', 
    count: true
});

//Add a slug before the domain gets saved to the database
domainSchema.pre("save", async function (next) {
    try {
        //Check if a new domain is being saved, or if the domain name is being modified
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

domainSchema.pre("remove", async function(next) {
    try {
        const populated = await this.populate("subjects").execPopulate();
        
        //Remove comments on subject
        const removeSubjects = populated.subjects;
        for (const removeSubject of removeSubjects) {
            await removeSubject.remove();
        }
        
    } catch (err) {
        //Handle error
        console.error(err);
        return next(err);
    }
});

async function generateUniqueSlug(id, domainTitle, slug, num) {
    try {
        //Generate the initial number
        if (!num) {
            num = 3;
        }
        //Generate the initial slug
        if (!slug) {
            slug = slugify(domainTitle, num);
        }
        //Check if a domain with the slug already exists
        const domain = await Domain.findOne({slug: slug});
        //Check if a domain was found or if the found domain is the current domain        
        if (!domain || domain._id == id) {
            return slug;
        }
        //If not unique, generate a new slug, increase random number digits
        const newSlug = slugify(domainTitle,num+1);
        //Check again by calling the function recursively
        return await generateUniqueSlug(id, domainTitle, newSlug, num+1);
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

const Domain = mongoose.model("Domain", domainSchema);

module.exports = Domain;