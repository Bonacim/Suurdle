const express = require("express");
const router  = express.Router({strict: true, mergeParams: true});
const { isLoggedIn, checkSubjectOwnership, sanitizer, findDomain, findSubject } = require("../middleware");
const Subject = require("../models/subject");
const Domain = require("../models/domain");
const mongoose = require("mongoose");

//INDEX - show all subjects
router.get("/", sanitizer, async function(req, res){
    try {
        //Set pagination variables
        const perPage = 8;
        const pageQuery = parseInt(req.query.page);
        const pageNumber = pageQuery ? pageQuery : 1;    
        if(req.query.search) {
            //Get a safe regex from search query
            const regex = new RegExp(escapeRegex(req.query.search), "gi");
            //Get all subjects on domain that match regex, apply pagination filter and count
            const domainFilteredSubjects = await Domain.findOne({slug: req.params.domainSlug}).populate([
                {
                    path:"subjects",
                    match: {name:regex}, 
                    options: {
                        skip: ((perPage * pageNumber) - perPage),
                        limit: perPage
                    }
                }, {
                    path: "countSubjects",
                    match: {name:regex}
                }
            ]).exec();
            const count = domainFilteredSubjects.countSubjects;

            if (!domainFilteredSubjects) {
                //Handle null result
                req.flash("error", "Domain not found");
                return res.redirect("back");
            }

            const filteredSubjects = domainFilteredSubjects.subjects;
            if(!filteredSubjects){
                //Handle null result
                req.flash("error", "Failed to retrieve subjects");
                return res.redirect("back");
            }
            if(filteredSubjects.length < 1) {
                //Handle empty result
                req.flash("error", "Subject not found");
                return res.redirect("back");
            }

            //Render index
            return res.render("subjects/index",{subjects:filteredSubjects, domain: domainFilteredSubjects, page:"subjects", current: pageNumber, pages: Math.ceil(count/perPage), search: req.query.search});
        } else {
            //No search query
            //Get all subjects on domain, apply pagination filter and count
            const domainAllSubjects = await Domain.findOne({slug: req.params.domainSlug}).populate([
                {
                    path:"subjects",
                    options: {
                        skip: ((perPage * pageNumber) - perPage),
                        limit: perPage
                    }
                }, {
                    path:"countSubjects",
                }
            ]).exec();
            const count = domainAllSubjects.countSubjects;

            if (!domainAllSubjects) {
                //Handle null result
                req.flash("error", "Domain not found");
                return res.redirect("back");
            }

            const allSubjects = domainAllSubjects.subjects;
            if(!allSubjects){
                //Handle null result
                req.flash("error", "Failed to retrieve subjects");
                return res.redirect("back");
            }

            //Render index
            return res.render("subjects/index",{subjects:allSubjects, domain: domainAllSubjects, page: "subjects", current: pageNumber, pages: Math.ceil(count/perPage), search: false});
        }
    } catch (err) {
        //Handle error
        req.flash("error","Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//CREATE - add a new subject to DB
router.post("/", sanitizer, isLoggedIn, findDomain, async function(req, res){    
    try {
        if (!req.foundDomain) {
            throw new Error("req.foundDomain is not valid");
        }
        const foundDomain = req.foundDomain;

        //Get data from form
        const newSubject = {
            name: req.body.subject.name, 
            referTo: req.body.subject.referTo, 
            creator: req.user.id,
            domain: foundDomain._id
        }

    
        //Add subject to DB
        const createdSubject = await Subject.create(newSubject);
        
        //Redirect back to subject page
        return res.redirect(`./subjects/${createdSubject.slug}`);
    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//NEW - show form to create new subject
router.get("/new", sanitizer, isLoggedIn, findDomain, async function(req, res){
    try {
        if (!req.foundDomain) {
            throw new Error("req.foundDomain is not valid");
        }
        const foundDomain = req.foundDomain;

        //Render new form
        return res.render("subjects/new",{domain: foundDomain, page: "domain"});         
    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//SHOW - show more info about one subject
router.get("/:subjectSlug", sanitizer, findSubject, async function(req, res){
    try {
        if (!req.foundSubject) {
            throw new Error("req.foundSubject is not valid");
        }
        const foundSubject = req.foundSubject;

        //Redirect to assignments INDEX
        return res.redirect("./"+foundSubject.slug+"/assignments/");
    } catch (err) {
         //Handle error
         req.flash("error", "Something went wrong");
         console.error(err);
         return res.redirect("back");
    }
});

//EDIT - show form to edit an existing subject
router.get("/:subjectSlug/edit", sanitizer, findSubject, checkSubjectOwnership, async function(req, res){
    try {
        if (!req.foundDomain) {
            throw new Error("req.foundDomain is not valid");
        }
        const foundDomain = req.foundDomain;
        if (!req.foundSubject) {
            throw new Error("req.foundSubject is not valid");
        }
        const foundSubject = req.foundSubject;

        //Render edit
        return res.render("subjects/edit", {subject: foundSubject, domain: foundDomain, page:"subject"});     
    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//UPDATE - update one subject on the DB
router.put("/:subjectSlug", sanitizer, findSubject, checkSubjectOwnership, async function(req, res){
    try {   
        if (!req.foundSubject) {
            throw new Error("req.foundSubject is not valid");
        }     
        const foundSubject = req.foundSubject;
        
        //Update only certain fields
        foundSubject.name = req.body.subject.name;
        foundSubject.referTo = req.body.subject.referTo;        
        foundSubject.verified = req.body.subject.verified ? true : false;
        await foundSubject.save();

        //Go to subject page
        req.flash("success", "Subject edited");
        return res.redirect("./" + foundSubject.slug);
    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//DESTROY - remove one subject from the DB
router.delete("/:subjectSlug", sanitizer, findSubject, checkSubjectOwnership, async function(req, res) {
    try {
        if (!req.foundSubject) {
            throw new Error("req.foundSubject is not valid");
        }
        const foundSubject = req.foundSubject;

        //Remove assigment
        await foundSubject.remove(); 

        //Go to index page
        req.flash("success", "Subject deleted");
        return res.redirect("./");
    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

module.exports = router;

