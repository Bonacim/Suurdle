const express = require("express");
const router  = express.Router({strict: true, mergeParams: true});
const { isLoggedIn, findDomain, checkDomainOwnership, sanitizer } = require("../middleware");
const Domain = require("../models/domain");

//INDEX - show all domains
router.get("/", sanitizer, async function(req, res){
    try {
        //Set pagination variables
        const perPage = 8;
        const pageQuery = parseInt(req.query.page);
        const pageNumber = pageQuery ? pageQuery : 1;    
        if(req.query.search) {
            //Get a safe regex from search query
            const regex = new RegExp(escapeRegex(req.query.search), "gi");
            //Get all domains from DB that match regex, apply pagination filter and count
            const filteredDomains = await Domain.find({name: regex}).skip((perPage * pageNumber) - perPage).limit(perPage).exec();
            const count = await Domain.countDocuments({name: regex}).exec();

            if(!filteredDomains){
                //Handle null result
                req.flash("error", "Failed to retrieve domains");
                return res.redirect("back");
            }
            if(filteredDomains.length < 1) {
                //Handle empty result
                req.flash("error", "Domain not found");
                return res.redirect("back");
            }

            //Render index
            return res.render("domains/index",{domains:filteredDomains, page:"domains", current: pageNumber, pages: Math.ceil(count/perPage), search: req.query.search});
        } else {
            //No search query
            //Get all domains from DB, apply pagination filter and count
            const allDomains = await Domain.find({}).skip((perPage * pageNumber) - perPage).limit(perPage).exec();
            const count = await Domain.countDocuments().exec();
            if(!allDomains){
                //Handle null result
                req.flash("error", "Failed to retrieve domains");
                return res.redirect("back");
            }

            //Render index
            return res.render("domains/index",{domains:allDomains, page: "domains", current: pageNumber, pages: Math.ceil(count/perPage), search: false});
        }
    } catch (err) {
        //Handle error
        req.flash("error","Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//CREATE - add a new domain to DB
router.post("/", sanitizer, isLoggedIn, async function(req, res){    
    try {

        //Get data from form
        const newDomain = {
            name: req.body.domain.name, 
            referTo: req.body.domain.referTo, 
            creator: req.user.id
        }

    
        //Add domain to DB
        const createdDomain = await Domain.create(newDomain);
        
        //Redirect back to domain page
        return res.redirect(`./domains/${createdDomain.slug}`);
    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//NEW - show form to create new domain
router.get("/new", sanitizer, isLoggedIn, async function(req, res){
    try {
        //Render new form
        return res.render("domains/new");         
    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//SHOW - show more info about one domain
router.get("/:domainSlug", sanitizer, findDomain, async function(req, res){
    try {
        if (!req.foundDomain) {
            throw new Error("req.foundDomain is not valid");
        }
        const foundDomain = req.foundDomain;

        //Redirect to subjects INDEX
        return res.redirect("./"+foundDomain.slug+"/subjects/");
    } catch (err) {
         //Handle error
         req.flash("error", "Something went wrong");
         console.error(err);
         return res.redirect("back");
    }
});

//EDIT - show form to edit an existing domain
router.get("/:domainSlug/edit", sanitizer, findDomain, checkDomainOwnership, async function(req, res){
    try {
        if (!req.foundDomain) {
            throw new Error("req.foundDomain is not valid");
        }
        const foundDomain = req.foundDomain;

        //Render edit
        return res.render("domains/edit", {domain: foundDomain, page: "domain"});     
    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//UPDATE - update one domain on the DB
router.put("/:domainSlug", sanitizer, findDomain, checkDomainOwnership, async function(req, res){
    try {
        if (!req.foundDomain) {
            throw new Error("req.foundDomain is not valid");
        }
        const foundDomain = req.foundDomain;

        //Update only certain fields
        foundDomain.name = req.body.domain.name;
        foundDomain.referTo = req.body.domain.referTo;
        foundDomain.verified = req.body.domain.verified ? true : false;
        await foundDomain.save();

        //Go to domain page
        req.flash("success", "Domain edited");
        return res.redirect("./" + foundDomain.slug);
    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//DESTROY - remove one domain from the DB
router.delete("/:domainSlug", sanitizer, findDomain, checkDomainOwnership, async function(req, res) {
    try {
        if (!req.foundDomain) {
            throw new Error("req.foundDomain is not valid");
        }
        const foundDomain = req.foundDomain;
        
        //Remove domain
        await foundDomain.remove(); 

        //Go to index page
        req.flash("success", "Domain deleted");
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

