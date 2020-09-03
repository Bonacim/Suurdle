const express = require("express");
const router  = express.Router({strict: true, mergeParams: true});
const { isLoggedIn, checkCommentOwnership, sanitizer, findAssignment, findComment } = require("../middleware");
const Assignment = require("../models/assignment");
const Comment = require("../models/comment");
const Vote = require("../models/vote");
const mongoose = require("mongoose")

//#TODO: create/edit/delete comments as ajax

//INDEX - show all comments from assignment (AJAX-only)
router.get("/", sanitizer, findAssignment, async function(req, res){
    const isAjax = req.xhr;
    try {
        //This should only be accessible through AJAX (might change it later)
        if(!isAjax) {
            //req.flash("error", "Something went wrong"); //login redirect falls here
            return res.redirect(req.baseUrl.replace("comments",""));
        }

        if (!req.foundAssignment) {
            throw new Error("req.foundAssignment is not valid");
        }
        const foundAssignment = await req.foundAssignment.populate({path: "comments", populate: {path: "votes"}}).execPopulate();
        if (!foundAssignment.comments){
            //Handle null result
            if (isAjax) {
                return res.send({error: "Failed to retrieve comments"});
            } else {
                req.flash("error", "Failed to retrieve comments");
                return res.redirect("back");
            }
        }        

        //Render show
        return res.render("comments/partials/index", {assignmentSlug: req.params.assignmentSlug, comments: foundAssignment.comments});
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

//SHOW - show all replies on comment (AJAX-only)
router.get("/:commentId", sanitizer, async function(req, res){
    const isAjax = req.xhr;
    try {
        //This should only be accessible through AJAX (might change it later)
        if(!isAjax) {
            //req.flash("error", "Something went wrong"); //login redirect falls here
            return res.redirect(req.baseUrl.replace("comments",""));
        }

        //Find the comment with provided id
        const foundComment = await Comment.findById(req.params.commentId).populate({path: "replies", populate: {path: "votes"}}).exec();
        if (!foundComment){
            //Handle null result
            if (isAjax) {
                return res.send({error: "Comment not found"});
            } else {
                req.flash("error", "Comment not found");
                return res.redirect("back");
            }
        }
        
        //Render show
        return res.render("comments/partials/show", {assignmentSlug: req.params.assignmentSlug, replies: foundComment.replies});
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

//CREATE - add a new comment to DB
router.post("/", sanitizer, isLoggedIn, findAssignment, async function(req, res){
    try {
        //Find assignment by slug
        if (!req.foundAssignment) {
            throw new Error("req.foundAssignment is not valid");
        }
        const foundAssignment = req.foundAssignment;

        //Allow only certain attributes to set
        const comment = {
            text: req.body.comment.text,
            author: req.user.username,
            modelId: foundAssignment._id,
            modelName: "Assignment"
        };

        //Add comment to DB
        await Comment.create(comment);

        //Go to assignment page
        req.flash("success", "Your comment has been successfully added.");
        return res.redirect(req.baseUrl.replace("comments",""));
        
    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//NEW - show form to create new comment
router.get("/new", sanitizer, isLoggedIn, findAssignment, async function(req, res){
    try {
        //Find assignment by id
        if (!req.foundAssignment) {
            throw new Error("req.foundAssignment is not valid");
        }
        const foundAssignment = req.foundAssignment;

        //Render new form
        return res.render("comments/new", {assignment: foundAssignment});

    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//EDIT - show form to edit an existing comment
router.get("/:commentId/edit", sanitizer, findComment, checkCommentOwnership, async function(req, res){
    try {
        if (!req.foundComment) {
            throw new Error("req.foundComment is not valid");
        }
        const foundComment = req.foundComment;

        //Render edit form
        return res.render("comments/edit", {comment: foundComment});
    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});
 
//UPDATE - update one comment on the DB
router.put("/:commentId", sanitizer, findComment, checkCommentOwnership, async function(req, res){
    try {
        if (!req.foundComment) {
            throw new Error("req.foundComment is not valid");
        }
        const foundComment = req.foundComment;
        
        //Allow only certain attributes to be edited
        const comment = {text: req.body.comment.text}
        
        //Update comment
        foundComment.text = comment.text;
        await foundComment.save();
        
        //Go to assignment page
        req.flash("success", "Comment edited");
        return res.redirect("../../" + req.params.assignmentSlug );
        
    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//DESTROY - remove one comment from the DB
router.delete("/:commentId", sanitizer, findComment, checkCommentOwnership, async function(req, res){
    try {
        if (!req.foundComment) {
            throw new Error("req.foundComment is not valid");
        }
        const foundComment = req.foundComment;

        //Remove
        await foundComment.remove();
        
        //Go to assignment page
        req.flash("success", "Comment deleted");
        return res.redirect("../../" + req.params.assignmentSlug);
        
    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
        
    }
});

//REPLY CREATE - add a reply to comment
router.post("/:commentId/reply", sanitizer, isLoggedIn, findComment, async function(req, res){
    try {
        if (!req.foundComment) {
            throw new Error("req.foundComment is not valid");
        }
        const foundComment = req.foundComment;

        let modelId;
        if (foundComment.modelName === "Comment") {
            //Add reply to parent comment
            modelId = foundComment.modelId;
        } else {
            //Add reply to the comment
            modelId = foundComment._id;
        }

        //Allow only certain attributes to set
        const reply = {
            text: req.body.comment.text,
            author: req.user.username,
            modelId: modelId,
            modelName: "Comment"
        };

        //Add reply to DB
        const createdReply = await Comment.create(reply);

        //Go to assignment page
        req.flash("success", "Your reply has been successfully added");
        return res.redirect(req.baseUrl.replace("comments",""));
        
    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//COMMENT VOTE - render the vote form (AJAX-only)
router.get("/:commentId/vote", sanitizer, findComment, async function(req, res) {
    const isAjax = req.xhr;
    try {
        //This should only be accessible through AJAX (might change it later)
        if(!isAjax) {
            //req.flash("error", "Something went wrong"); //login redirect falls here
            return res.redirect(req.baseUrl.replace("comments",""));
        }

        if (!req.foundComment) {
            throw new Error("req.foundComment is not valid");
        }
        const foundComment = await req.foundComment.populate("votes").execPopulate();

        let likes = [];
        let dislikes = [];
        foundComment.votes.forEach(function(vote) {
            if (vote.upvote) {
                likes.push(vote);
            } else {
                dislikes.push(vote);
            }
        });

        //Render vote
        return res.render("comments/partials/vote", {assignmentSlug: req.params.assignmentSlug,comment: foundComment, likes: likes, dislikes: dislikes});
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

//COMMENT VOTE - add a new vote to one assignment (AJAX)
router.post("/:commentId/vote", sanitizer, isLoggedIn, findComment, async function (req, res) {    
    const isAjax = req.xhr;
    try {        
        if (!req.foundComment) {
            throw new Error("req.foundComment is not valid");
        }
        const foundComment = req.foundComment;
        
        //Set user vote
        const userVote = {
            user: req.user.username,
            upvote: req.body.like === "1",
            modelName: "Comment",
            modelId: foundComment._id
        }
        const scoreIncrement = userVote.upvote ? 1 : -1;

        //Check if user has already voted
        const foundVote = await Vote.findOne({modelId: mongoose.Types.ObjectId(foundComment._id), modelName: "Comment", user: userVote.user});
        if (foundVote) {
            //Check vote direction
            if (foundVote.upvote === userVote.upvote) {
                //User already voted in the same direction, removing vote
                await foundVote.remove();
                foundComment.score = foundComment.score - scoreIncrement;
            } else {
                //User already voted in the opposite direction, change vote
                foundVote.upvote = userVote.upvote;
                await foundVote.save();
                foundComment.score = foundComment.score + 2*scoreIncrement;
            }
        } else {
            //Adding the new user vote
            await Vote.create(userVote);
            foundComment.score = foundComment.score + scoreIncrement;
        }

        //Update comment
        await foundComment.save({timestamps: false});        

        if (isAjax) {
            return res.redirect("./vote");
        } else {
            //Go to assignment page
            return res.redirect(req.baseUrl.replace("comments",""));
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

module.exports = router;