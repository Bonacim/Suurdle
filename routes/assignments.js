const express = require("express");
const router  = express.Router({strict: true, mergeParams: true});
const { isLoggedIn, findSubject, findAssignment, checkAssignmentOwnership, sanitizer, multerAll } = require("../middleware");
const Assignment = require("../models/assignment");
const Domain = require("../models/domain");
const User = require("../models/user");
const Notification = require("../models/notification");
const cloudinary = require("cloudinary");
const Vote = require("../models/vote");
const mongoose = require("mongoose");

//#TODO: change method for uploading/deleting attachments, currently slowing down page load. Possible solutions: 1) Ajax requests, only submit form after upload/delete completion. 2) Turn attachments into a collection and handle save,modify and delete hooks. 3)Refactor async/await
//#TODO: Add tag functionality (add, remove, search for)
//#TODO: rich edit
//#TODO: edit/delete buttons on hamburguer
//#TODO: add permalink

//INDEX - show all assignments
router.get("/", sanitizer, async function(req, res){
    try {
        //Set pagination variables
        const perPage = 8;
        const pageQuery = parseInt(req.query.page);
        const pageNumber = pageQuery ? pageQuery : 1;    
        if(req.query.search) {
            //Get a safe regex from search query
            const regex = new RegExp(escapeRegex(req.query.search), "gi");
            //Get all assignments on subject that match regex, apply pagination filter and count
            const domainFilteredAssignments = await Domain.findOne({slug: req.params.domainSlug}).populate({
                path:"subjects",
                match: {slug:req.params.subjectSlug}, 
                options: {limit: 1},
                populate: [
                    {
                        path: "assignments",
                        match: {title:regex}, 
                        options: {
                            skip: ((perPage * pageNumber) - perPage),
                            limit: perPage
                        }
                    }, {
                        path: "countAssignments",
                        match: {title:regex}
                    }
                ]
            }).exec();

            if (!domainFilteredAssignments) {
                //Handle null result
                req.flash("error", "Domain not found");
                return res.redirect("back");
            }

            const subjectsFilteredAssignments = domainFilteredSubjects.subjects;            
            if (!subjectsFilteredAssignments || subjectsFilteredAssignments.length === 0){
                //Handle null/empty result
                req.flash("error", "Subject not found");
                return res.redirect("back");
            }
            const subjectFilteredAssignments = subjectsFilteredAssignments[0];
            const count = subjectFilteredAssignments.countAssignments;
            const filteredAssignments = subjectFilteredAssignments.assignments;

            if (!filteredAssignments){
                //Handle null
                req.flash("error", "Failed to retrieve assignments");
                return res.redirect("back");
            }

            if(filteredAssignments.length < 1) {
                //Handle empty result
                req.flash("error", "Assignment not found");
                return res.redirect("back");
            }

            //Render index
            return res.render("assignments/index",{assignments:filteredAssignments, page:"assignments", current: pageNumber, pages: Math.ceil(count/perPage), search: req.query.search});
        } else {
            //No search query
            //Get all assignments on subject, apply pagination filter and count
            const domainAllAssignments = await Domain.findOne({slug: req.params.domainSlug}).populate({
                path:"subjects",
                match: {slug:req.params.subjectSlug}, 
                options: {limit: 1},
                populate: [
                    {
                        path: "assignments",
                        options: {
                            skip: ((perPage * pageNumber) - perPage),
                            limit: perPage
                        }
                    }, {
                        path: "countAssignments"
                    }
                ]
            }).exec();

            if (!domainAllAssignments) {
                //Handle null result
                req.flash("error", "Domain not found");
                return res.redirect("back");
            }
            
            const subjectsAllAssignments = domainAllAssignments.subjects;            
            if (!subjectsAllAssignments || subjectsAllAssignments.length === 0){
                //Handle null/empty result
                req.flash("error", "Subject not found");
                return res.redirect("back");
            }
            const subjectAllAssignments = subjectsAllAssignments[0];
            const count = subjectAllAssignments.countAssignments;
            const allAssignments = subjectAllAssignments.assignments;

            if (!allAssignments){
                //Handle null
                req.flash("error", "Failed to retrieve assignments");
                return res.redirect("back");
            }

            //Render index
            return res.render("assignments/index",{domain: domainAllAssignments, subject: subjectAllAssignments, assignments: allAssignments, page: "assignments", current: pageNumber, pages: Math.ceil(count/perPage), search: false});
        }
    } catch (err) {
        //Handle error
        req.flash("error","Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//CREATE - add a new assignment to DB
router.post("/", sanitizer, isLoggedIn, multerAll.array("assignment[attachments]"), async function(req, res){    
    try {

        //Find the subject with provided slug
        const domainFoundSubject = await Domain.findOne({slug: req.params.domainSlug}).populate({
            path:"subjects",
            match: {slug: req.params.subjectSlug},
            options: {limit: 1}
        }).exec();

        if (!domainFoundSubject) {
            //Handle null result
            req.flash("error", "Domain not found");
            return res.redirect("back");
        }

        const foundSubjects = domainFoundSubject.subjects;
        if (!foundSubjects || foundSubjects.length === 0){
            //Handle null/empty result
            req.flash("error", "Subject not found");
            return res.redirect("back");
        }
        const foundSubject = foundSubjects[0];

        //Upload attachments
        let attachments = [];
        if (req.files && req.files.length != 0) {            
            const files = Array.from(req.files);
            for (const file of files) {
                //check if file size is greater than the allowed
                if (file.size > 10485760) {//#TODO: 10MB limit for upload (could use 100MB with upload_large, should change on final version)
                    req.flash("error", "One of the attachments exceeds the size limit of 10 MB");
                    return res.redirect("back");
                }
                resource_type = "raw"
                if (file.mimetype.startsWith("image")) {
                    resource_type = "image";
                } else if (file.mimetype.startsWith("video")) {
                    resource_type = "video";
                }
                const result = await cloudinary.v2.uploader.upload(file.path, {resource_type: resource_type, folder: "Attachments"});
                attachments.push({
                    url: result.secure_url,
                    id: result.public_id,
                    name: file.filename,
                    mimetype: file.mimetype
                });                
            }
        }

        //Get data from form
        const newAssignment = {
            title: req.body.assignment.title, 
            description: req.body.assignment.description, 
            author: req.user.username,
            attachments: attachments,
            subject: foundSubject._id
        }

    
        //Add assignment to DB
        const createdAssignment = await Assignment.create(newAssignment);
        //Find current user, populate followers
        const currentUser = await User.findById(req.user._id).populate("followers").exec();
        if (!currentUser){
            //Handle null result
            req.flash("error", "User not found");
            return res.redirect("back");
        }
        
        //Create notification
        const newNotification = {
            sender: req.user.username,
            assignmentId: createdAssignment.id
        }
        //#TODO: should use background job or sockets, not very scalable this way
        //#TODO: need to check https://pusher.com/tutorials/realtime-notifications-nodejs for realtime
        //Add notification to all followers
        for(const follow of currentUser.followers) {
            const notification = newNotification;
            notification.receiver = follow.follower;
            Notification.create(notification);
        }
        //Redirect back to assignment page
        return res.redirect(`./assignments/${createdAssignment.slug}`);
    } catch (err) {
        //Handle error
        //#TODO: check if attachment was uploaded and destroy it if the assignment is not saved
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//NEW - show form to create new assignment
router.get("/new", sanitizer, isLoggedIn, findSubject, async function(req, res){
    try {
        if (!req.foundDomain) {
            throw new Error("req.foundDomain is not valid");
        }
        const foundDomain = req.foundDomain;
        if (!req.foundSubject) {
            throw new Error("req.foundSubject is not valid");
        }
        const foundSubject = req.foundSubject;

        //Render new form
        return res.render("assignments/new", {domain: foundDomain, subject: foundSubject, page: "subject"});         
    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//SHOW - show more info about one assignment
router.get("/:assignmentSlug", sanitizer, findAssignment, async function(req, res){
    try {
        if (!req.foundDomain) {
            throw new Error("req.foundDomain is not valid");
        }
        const foundDomain = req.foundDomain;
        if (!req.foundSubject) {
            throw new Error("req.foundSubject is not valid");
        }
        const foundSubject = req.foundSubject;
        if (!req.foundAssignment) {
            throw new Error("req.foundAssignment is not valid");
        }
        const foundAssignment = req.foundAssignment;

        //Render show
        return res.render("assignments/show", {domain: foundDomain, subject: foundSubject, assignment: foundAssignment, page: "assignment"});
    } catch (err) {
         //Handle error
         req.flash("error", "Something went wrong");
         console.error(err);
         return res.redirect("back");
    }
});

//EDIT - show form to edit an existing assignment
router.get("/:assignmentSlug/edit", sanitizer, findAssignment, checkAssignmentOwnership, async function(req, res){
    try {
        if (!req.foundDomain) {
            throw new Error("req.foundDomain is not valid");
        }
        const foundDomain = req.foundDomain;
        if (!req.foundSubject) {
            throw new Error("req.foundSubject is not valid");
        }
        const foundSubject = req.foundSubject;
        if (!req.foundAssignment) {
            throw new Error("req.foundAssignment is not valid");
        }
        const foundAssignment = req.foundAssignment;

        //Render edit
        return res.render("assignments/edit", {domain: foundDomain, subject: foundSubject, assignment: foundAssignment, page: "assignment"});     
    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//UPDATE - update one assignment on the DB
router.put("/:assignmentSlug", sanitizer, findAssignment, checkAssignmentOwnership, multerAll.array("assignment[attachments]"), async function(req, res){
    try {
        if (!req.foundAssignment) {
            throw new Error("req.foundAssignment is not valid");
        }
        const foundAssignment = req.foundAssignment;

        //Upload attachments
        let attachments = [];
        if (req.files && req.files.length != 0) {            
            const files = Array.from(req.files);
            for (const file of files) {
                //check if file size is greater than the allowed
                if (file.size > 10485760) {//#TODO: 10MB limit for upload (could use 100MB with upload_large, should change on deployment)
                    req.flash("error", "One of the attachments exceeds the size limit of 10 MB");
                    return res.redirect("back");
                }
                resource_type = "raw";
                if (file.mimetype.startsWith("image")) {
                    resource_type = "image";
                } else if (file.mimetype.startsWith("video")) {
                    resource_type = "video";
                }
                const result = await cloudinary.v2.uploader.upload(file.path, {resource_type: resource_type, folder: "Attachments"});
                attachments.push({
                    url: result.secure_url,
                    id: result.public_id,
                    name: file.filename,
                    mimetype: file.mimetype
                });
            }
        }

        let removeList = [];
        if (req.body.remove) {
            removeList = req.body.remove.map(item => (Array.isArray(item) && item[1]) || null);
        }            
       
        if (removeList.includes("1")) {
            //Remove attachments
            let removeAttachmentsId = [];
            removeList.forEach((value, i) => {
                if (value === "1") {
                    //Find the id of selected attachments for removal
                    removeAttachmentsId.push(foundAssignment.attachments[i].id);
                }
            });
            
            for (const removeAttachmentId of removeAttachmentsId) {                
                await cloudinary.v2.uploader.destroy(removeAttachmentId);//doesn't throw error deleting an invalid id
            }

            //Remove removed attachments from assignment's attachments
            foundAssignment.attachments = foundAssignment.attachments.filter(attachment => !removeAttachmentsId.includes(attachment.id));
        }

        //Update only certain fields
        foundAssignment.title = req.body.assignment.title;
        foundAssignment.description = req.body.assignment.description;
        if (foundAssignment.attachments && foundAssignment.attachments.length > 0) {
            //Assignment already has attachments
            foundAssignment.attachments = foundAssignment.attachments.concat(attachments);
        } else if (attachments.length != 0) {
            //Assignment doesn't have attachments and user uploaded new attachments
            foundAssignment.attachments = attachments;
        }            
        await foundAssignment.save();  

        //Go to assignment page
        req.flash("success", "Assignment edited");
        return res.redirect("./" + foundAssignment.slug);
    } catch (err) {
        //Handle error
        //#TODO: check if attachment was uploaded and destroy it if the assignment is not saved
        //#TODO: check if attachment was deleted and remove it from assignment
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//DESTROY - remove one assignment from the DB
router.delete("/:assignmentSlug", sanitizer, findAssignment, checkAssignmentOwnership, async function(req, res) {
    try {
        if (!req.foundAssignment) {
            throw new Error("req.foundAssignment is not valid");
        }
        const foundAssignment = req.foundAssignment;

        //Remove assigment
        await foundAssignment.remove(); 

        //Go to index page
        req.flash("success", "Assignment deleted");
        return res.redirect("./");
    } catch (err) {
        //Handle error
        //#TODO: check if attachment was deleted and remove it from assignment
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//ASSIGNMENT VOTE - render the vote form (AJAX-only)
router.get("/:assignmentSlug/vote", sanitizer, findAssignment, async function(req, res) {
    const isAjax = req.xhr;
    try {
        //This should only be accessible through AJAX (might change it later)
        if(!isAjax) {
            //req.flash("error", "Something went wrong"); //login redirect falls here
            return res.redirect("./"); 
        }
       
        if (!req.foundAssignment) {
            throw new Error("req.foundAssignment is not valid");
        }
        const foundAssignment = await req.foundAssignment.populate("votes").execPopulate();

        let likes = [];
        let dislikes = [];
        foundAssignment.votes.forEach(function(vote) {
            if (vote.upvote) {
                likes.push(vote);
            } else {
                dislikes.push(vote);
            }
        });

        //Render vote
        return res.render("assignments/partials/vote", {assignment: foundAssignment, likes: likes, dislikes: dislikes});
    } catch (err) {
        //Handle error
        if (isAjax) {
            console.error(err);
            return res.send({error: "Something went wrong"});
        } else {
            req.flash("error", "Something went wrong");
            console.error(err);
            return res.redirect("back"); 
        }
    }
});

//ASSIGNMENT VOTE - add a new vote to one assignment (AJAX)
router.post("/:assignmentSlug/vote", sanitizer, isLoggedIn, findAssignment, async function (req, res) {    
    const isAjax = req.xhr;
    try {
        if (!req.foundDomain) {
            throw new Error("req.foundDomain is not valid");
        }
        const foundDomain = req.foundDomain;
        if (!req.foundSubject) {
            throw new Error("req.foundSubject is not valid");
        }
        const foundSubject = req.foundSubject;
        if (!req.foundAssignment) {
            throw new Error("req.foundAssignment is not valid");
        }
        const foundAssignment = req.foundAssignment;
        
        //Set user vote
        const userVote = {
            user: req.user.username,
            upvote: req.body.like === "1",
            modelName: "Assignment",
            modelId: foundAssignment._id
        }
        const scoreIncrement = userVote.upvote ? 1 : -1;

        //Check if user has already voted
        const foundVote = await Vote.findOne({modelId: mongoose.Types.ObjectId(foundAssignment._id), modelName: "Assignment", user: userVote.user});
        if (foundVote) {
            //Check vote direction
            if (foundVote.upvote === userVote.upvote) {
                //User already voted in the same direction, removing vote
                await foundVote.remove();
                foundAssignment.score = foundAssignment.score - scoreIncrement;
            } else {
                //User already voted in the opposite direction, change vote
                foundVote.upvote = userVote.upvote;
                await foundVote.save();
                foundAssignment.score = foundAssignment.score + 2*scoreIncrement;
            }
        } else {
            //Adding the new user vote
            await Vote.create(userVote);
            foundAssignment.score = foundAssignment.score + scoreIncrement;
        }

        //Update assignment
        await foundAssignment.save({timestamps: false});        

        if (isAjax) {
            return res.redirect("./vote");
        } else {
            //Go to assignment page
            return res.redirect("./");
        }
        
    } catch (err) {
        //Handle error
        if (isAjax) {
            console.error(err);
            return res.send({error: "Something went wrong"});
        } else {
            req.flash("error", "Something went wrong");
            console.error(err);
            return res.redirect("back"); 
        }
    }
});

function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

module.exports = router;

