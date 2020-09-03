const Domain = require("../models/domain");
const Subject = require("../models/subject");
const Assignment = require("../models/assignment");
const Comment = require("../models/comment");
const sanitize = require("mongo-sanitize");
const multer = require("multer");
const mongoose = require("mongoose");

const storage = multer.diskStorage({
    filename: function(req, file, callback) {
        callback(null, Date.now() + " " + file.originalname);
    }
});
const imageFilter = function (req, file, cb) {
    // accept image files only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};

//all the middleare goes here
const middlewareObj = {
    findDomain: async function(req,res, next) {
        try {
            //Find assigment by slug
            const foundDomain = await Domain.findOne({slug: req.params.domainSlug});
            if(!foundDomain){
                //Handle null result
                req.flash("error", "Domain not found");
                return res.redirect("back");
            }

            req.foundDomain = foundDomain;
            return next();            
        } catch (err) {
            //Handle error
            req.flash("error", "Something went wrong");
            console.error(err);
            return res.redirect("back");
        }
    },
    checkDomainOwnership: async function(req, res, next) {
        try {
            //Check if user is authenticated
            if(!req.isAuthenticated()) {
                //Middleware reject
                req.flash("error", "You need to be logged in to do that");
                return res.redirect("/login");
            } 


            if (!req.foundDomain) {
                throw new Error("findDomain must be called before checkDomainOwnership");
            }
            const foundDomain = req.foundDomain;

            //Check if user is admin
            if(req.user.isAdmin) {
                //Middleware accept
                return next();
            }

            //Middleware reject
            req.flash("error", "You don't have permission to do that");
            return res.redirect("back");                   
        } catch (err) {
            //Handle error
            req.flash("error", "Something went wrong");
            console.error(err);
            return res.redirect("back");
        }
    },
    findSubject: async function(req, res, next) {
        try {
            //Find the subject on domain with provided slug
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
            req.foundDomain = domainFoundSubject;

            const foundSubjects = domainFoundSubject.subjects;
            if (!foundSubjects || foundSubjects.length === 0){
                //Handle null/empty result
                req.flash("error", "Subject not found");
                return res.redirect("back");
            }

            req.foundSubject = foundSubjects[0];
            return next();
        } catch (err) {
            //Handle error
            req.flash("error", "Something went wrong");
            console.error(err);
            return res.redirect("back");
        }
        
    },
    checkSubjectOwnership: async function(req, res, next) {
        try {
            //Check if user is authenticated
            if(!req.isAuthenticated()) {
                //Middleware reject
                req.flash("error", "You need to be logged in to do that");
                return res.redirect("/login");
            } 

            if (!req.foundSubject) {
                throw new Error("findSubject must be called before checkSubjectOwnership");
            }
            const foundSubject = req.foundSubject;

            //Check if user is admin
            if(req.user.isAdmin) {
                //Middleware accept
                return next();
            }

            //Middleware reject
            req.flash("error", "You don't have permission to do that");
            return res.redirect("back");                   
        } catch (err) {
            //Handle error
            req.flash("error", "Something went wrong");
            console.error(err);
            return res.redirect("back");
        }
    },
    findAssignment: async function(req, res, next) {
        const isAjax = req.xhr;
        try {
            //Find the assignment with provided slug
            const domainFoundAssignment = await Domain.findOne({slug: req.params.domainSlug}).populate({
                path:"subjects",
                match: {slug: req.params.subjectSlug},
                options: {limit: 1},
                populate: [
                    {
                        path: "assignments",
                        match: {slug: req.params.assignmentSlug},
                        options: {limit: 1}
                    }
                ]
            }).exec();

            if (!domainFoundAssignment) {
                //Handle null result
                if (isAjax) {
                    return res.send({error: "Domain not found"});
                } else {
                    req.flash("error", "Domain not found");
                    return res.redirect("back");
                }
            }
            req.foundDomain = domainFoundAssignment;

            const subjectsFoundAssignment = domainFoundAssignment.subjects;
            if (!subjectsFoundAssignment || subjectsFoundAssignment.length === 0){
                //Handle null/empty result
                if (isAjax) {
                    return res.send({error: "Subject not found"});
                } else {
                    req.flash("error", "Subject not found");
                    return res.redirect("back");
                }
            }
            const subjectFoundAssignment = subjectsFoundAssignment[0];
            req.foundSubject = subjectFoundAssignment;

            const foundAssignments = subjectFoundAssignment.assignments;
            if (!foundAssignments || foundAssignments.length === 0){
                //Handle null/empty result
                if (isAjax) {
                    return res.send({error: "Assignment not found"});
                } else {
                    req.flash("error", "Assignment not found");
                    return res.redirect("back");
                }
            }
            req.foundAssignment = foundAssignments[0];

            return next();
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
        
    },
    checkAssignmentOwnership: async function(req, res, next) {
        const isAjax = req.xhr;
        try {
            //Check if user is authenticated
            if(!req.isAuthenticated()) {
                //Middleware reject
                req.flash("error", "You need to be logged in to do that");
                if (isAjax) {
                    return res.send({error: "You need to be logged in to do that", redirect: "/login"});
                } else {
                    return res.redirect("/login");
                }
            } 

            if (!req.foundAssignment) {
                throw new Error("findAssignment must be called before checkAssignmentOwnership");
            }
            const foundAssignment = req.foundAssignment;

            //Check if user own the assignment or is admin
            if(foundAssignment.author === req.user.username || req.user.isAdmin) {
                //Middleware accept
                return next();
            }

            //Middleware reject
            if (isAjax) {
                return res.send({error: "You don't have permission to do that"})
            } else {
                req.flash("error", "You don't have permission to do that");
                return res.redirect("back");                   
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
    },
    findComment: async function(req, res, next) {
        const isAjax = req.xhr;
        try {
            //Find the comment by id
            const domainFoundComment = await Domain.findOne({slug: req.params.domainSlug}).populate({
                path:"subjects",
                match: {slug: req.params.subjectSlug},
                options: {limit: 1},
                populate: [
                    {
                        path: "assignments",
                        match: {slug: req.params.assignmentSlug},
                        options: {limit: 1},
                        populate: [
                            {
                                path: "comments",
                                match: {_id: mongoose.Types.ObjectId(req.params.commentId)},
                                options: {limit: 1}
                            }
                        ]
                    }
                ]
            }).exec();

            if (!domainFoundComment) {
                //Handle null result
                if (isAjax) {
                    return res.send({error: "Domain not found"});
                } else {
                    req.flash("error", "Domain not found");
                    return res.redirect("back");
                }
            }
            req.foundDomain = domainFoundComment;

            const subjectsFoundAssignment = domainFoundComment.subjects;
            if (!subjectsFoundAssignment || subjectsFoundAssignment.length === 0){
                //Handle null/empty result
                if (isAjax) {
                    return res.send({error: "Subject not found"});
                } else {
                    req.flash("error", "Subject not found");
                    return res.redirect("back");
                }
            }
            const subjectFoundAssignment = subjectsFoundAssignment[0];
            req.foundSubject = subjectFoundAssignment;

            const foundAssignments = subjectFoundAssignment.assignments;
            if (!foundAssignments || foundAssignments.length === 0){
                //Handle null/empty result
                if (isAjax) {
                    return res.send({error: "Assignment not found"});
                } else {
                    req.flash("error", "Assignment not found");
                    return res.redirect("back");
                }
            }
            const foundAssignment = foundAssignments[0];
            req.foundAssignment = foundAssignment;

            const foundComments = foundAssignment.comments;
            if (!foundComments || foundComments.length === 0){
                //Comment may be a reply
                const populatedAssignment = await foundAssignment.populate({
                    path: "comments",
                    options: {limit: 1},
                    populate: [
                        {
                            path: "replies",
                            match: {_id: mongoose.Types.ObjectId(req.params.commentId)},
                            options: {limit: 1}
                        }
                    ]
                }).execPopulate();

                if (!populatedAssignment) {
                    //Handle null result
                    if (isAjax) {
                        return res.send({error: "Failed to retrieve replies"});
                    } else {
                        req.flash("error", "Failed to retrieve replies");
                        return res.redirect("back");
                    }
                }

                const populatedComments = populatedAssignment.comments;
                if (!populatedComments || populatedComments.length === 0){
                    //Handle null/empty result
                    if (isAjax) {
                        return res.send({error: "Comment not found"});
                    } else {
                        req.flash("error", "Comment not found");
                        return res.redirect("back");
                    }
                }
                const parentComment = populatedComments[0];

                const foundReplies = parentComment.replies;
                if (!foundReplies || foundReplies.length === 0 ) {
                    //Handle null/empty result
                    if (isAjax) {
                        return res.send({error: "Reply not found"});
                    } else {
                        req.flash("error", "Reply not found");
                        return res.redirect("back");
                    }
                }

                //Comment is a reply on a comment
                req.foundComment = foundReplies[0];            
                return next();

            } else {
                //Comment is a comment on the assignment
                req.foundComment = foundComments[0];            
                return next();
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
        
    },
    checkCommentOwnership: async function(req, res, next) {
        try {
            //Check if user is authenticated
            if(!req.isAuthenticated()){
                //Middleware reject
                req.flash("error", "You need to be logged in to do that");
                return res.redirect("back");
            }
    
            //Find comment by id
            const foundComment = await Comment.findById(req.params.commentId);
            if(!foundComment){
                //Handle null result
                req.flash("error", "Comment not found");
                return res.redirect("back");
            }
    
            //Check if user own the comment or is admin
            if(foundComment.author === req.user.username || req.user.isAdmin) {
                //Middleware accept
                return next();
            }
    
            //Middleware reject
            req.flash("error", "You don't have permission to do that");
            return res.redirect("back");        
        } catch (err) {
            //Handle error
            req.flash("error", "Something went wrong");
            console.error(err);
            return res.redirect("back");
        }
    },
    
    isLoggedIn: async function(req, res, next){
        const isAjax = req.xhr;
        try {
            //Check if user is authenticated
            if(req.isAuthenticated()){
                //Middleware accept
                return next();
            }
            //Middleware reject
            req.session.redirectTo = req.originalUrl;
            req.flash("error", "You need to be logged in to do that");
            if (isAjax) {
                return res.send({error: "You need to be logged in to do that", redirect: "/login"});
            } else {
                return res.redirect("/login");
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
    },
    
    sanitizer: async function(req, res, next){
        const isAjax = req.xhr;
        try {
            req.body = sanitize(req.body);
            req.params = sanitize(req.params);
            req.query = sanitize(req.query);
            return next();
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
        
    },

    multerAll: multer({ storage: storage}),

    multerImages: multer({ storage: storage, fileFilter: imageFilter})
};

module.exports = middlewareObj;