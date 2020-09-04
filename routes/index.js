const express = require("express");
const router  = express.Router({strict: true, mergeParams: true});
const passport = require("passport");
const crypto = require("crypto");
const { isLoggedIn, sanitizer, multerImages } = require("../middleware");
const User = require("../models/user");
const Notification = require("../models/notification");
const Assignment = require("../models/assignment");
const cloudinary = require("cloudinary");
const sgMail = require('@sendgrid/mail'); //#TODO: domain authentication, Outlook blocks email by sendgrid without authentication, Gmail works fine
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

//#TODO: allow user to edit profile (name, avatar and email)
//#TODO: make notification for comments
//#TODO: style notifications

//Root
router.get("/", sanitizer, async function(req, res){
    try {        
        return res.render("landing");
    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

// GET /contact
router.get("/contact", sanitizer, isLoggedIn, async function(req, res) {
    try {
        return res.render("contact", {page: "contact"});        
    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

// POST /contact
router.post("/contact", sanitizer, isLoggedIn, async function(req, res) {
    try {
        const name = req.user.username;
        const email = req.user.email;
        const message = req.sanitize(req.body.message);//remove script tags
        const msg = {
          to: "suurdledev@gmail.com",
          from: "suurdledev@gmail.com", //Need domain authentication to send the email from the user https://sendgrid.com/docs/ui/sending-email/sender-verification
          subject: `Suurdle Contact Form from ${name}`,
          replyTo: email,
          text: message,
          html: `
          <h4>User: ${name}. Email: ${email}</h4>
          <p>${message}</p>
          `,
        };
        await sgMail.send(msg);
        req.flash("success", "Thank you for your email, we will get back to you shortly.");
        res.redirect("/contact");
    } catch (err) {
        //Handle error
        console.error(err);
        if (err.response) {
            console.log(err.response.body);
        }
        req.flash("error", "Sorry, something went wrong, please contact suurdledev@gmail.com");
        return res.redirect("back");
    }
});

//REGISTER - show form to register new user
router.get("/register", sanitizer, async function(req, res){
    try {
        //Render register form
        return res.render("register", {page: "register"});         
    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//REGISTER - register a new user on the DB
router.post("/register", sanitizer, multerImages.single("avatar"), async function(req, res){
    try {
        //Get data from form
        const newUser = new User({
            username: req.body.username, 
            email: req.body.email,
            firstName: req.body.firstName,
            lastName: req.body.lastName
        });
        //Upload avatar
        if (req.file) {
            const result = await cloudinary.v2.uploader.upload(req.file.path, {folder: "Users"});
            newUser.avatar = {
                url: result.secure_url,
                id: result.public_id
            }
        }

        //Add user to DB
        const registeredUser = await User.register(newUser, req.body.password);
        passport.authenticate("local")(req, res, function(){ //authenticate fires next(), using callback
            //Go to landing
            req.flash("success", "Welcome to Suurdle " + registeredUser.username);
            return res.redirect("/"); 
        });
        
    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//LOGIN - show form to login
router.get("/login", sanitizer, async function(req, res){
    try {
        //Redirects the user if already logged in
        if(req.isAuthenticated()) {
            return res.redirect("back");
        }

        if (req.session.redirectTo) {
            //Remove the redirectTo after user has switched page, save value in buffer
            req.session.loginRedirectTo = req.session.redirectTo;
            delete req.session.redirectTo;
        } else {
            //Save the previous URL as redirect
            req.session.loginRedirectTo = req.headers.referer;
        }
    
        return res.render("login", {page: "login"});
    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//LOGIN - handle login logic
router.post("/login", sanitizer, async function(req, res, next) {
    try {
        
        //Authenticate user
        passport.authenticate("local", function(err, user, info) {
            if (err) {throw err;}//Let outside catch handle

            if (!user) {
                //Handle null result
                req.flash("error", "Incorrect username or password");
                return res.redirect("/login"); 
            }
    
            //Login
            req.logIn(user, function(err) {
                if (err) {throw err;}//Let outside catch handle

                //Redirect
                const loginRedirectTo = req.session.loginRedirectTo ? req.session.loginRedirectTo : "back";
                delete req.session.loginRedirectTo;
                return res.redirect(loginRedirectTo);
            });
        })(req, res, next);
        
    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//LOGOUT - handle logout logic
router.get("/logout", sanitizer, function(req, res){
     try {
         //Logout user
         req.logout();
         req.flash("success", "Logged you out!");
         //Go to landing
         return res.redirect("/");        
    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//FORGOT - show forgot password form
router.get("/forgot", sanitizer, function(req, res) {
    try {
        //Render forgot form
        return res.render("forgot");
    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//FORGOT - handle the forgot password logic
router.post("/forgot",  sanitizer, async function(req, res) {
    try {
        //Generate token
        const buf = crypto.randomBytes(20);
        const token = buf.toString("hex");
        
        //Find user by email
        let user = await User.findOne({ email: req.body.email });
        if (!user) {
            //Handle null result
            req.flash("error", "No account with that email address exists.");
            return res.redirect("/forgot");
        }

        //Save user with token
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour                  
        await user.save();
        
        //Set the email service
        const msg = {
            to: user.email,
            from: "suurdledev@gmail.com",
            subject: "Suurdle Password Reset",
            text: "You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n" +
                "Please click on the following link, or paste this into your browser to complete the process:\n\n" +
                "http://" + req.headers.host + "/reset/" + token + "\n\n" +
                "If you did not request this, please ignore this email and your password will remain unchanged.\n"
        };

        await sgMail.send(msg);
        req.flash("success", "An e-mail has been sent to " + user.email + " with further instructions.");
        return res.redirect("/forgot");

    } catch (err) {
        console.error(err);
        if (err.response) {
            console.log(err.response.body);
        }
        req.flash("error", "Sorry, something went wrong, please contact suurdledev@gmail.com");
        return res.redirect("back");
    }
});

//RESET - show the reset password form
router.get("/reset/:token", sanitizer, async function(req, res) {
    try {
        //Find user by token
        const foundUser = await User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } });
        if (!foundUser) {
            //Handle null result
            req.flash("error", "Password reset token is invalid or has expired.");
            return res.redirect("/forgot");
        }

        //Render reset page
        return res.render("reset", {token: req.params.token});
        
    } catch (err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//RESET - handle the reset password logic
router.post("/reset/:token", sanitizer, async function(req, res) {
    try {        
        //Find user by token
        let user = await User.findOne({resetPasswordToken: req.params.token, resetPasswordExpires: {$gt: Date.now()}});
        if (!user) {
            //Handle null result
            req.flash("error", "Password reset token is invalid or has expired.");
            return res.redirect("back");
        }

        if(req.body.password !== req.body.confirm) {
            //Different passwords
            req.flash("error", "Passwords do not match.");
            return res.redirect("back");
        }

        //Change password
        await user.setPassword(req.body.password);
            
        //Delete token
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        //Save user
        await user.save();

        //Log back in
        req.logIn(user, function(err) {
            if (err) {throw err;}//Let outside catch handle
        });
            
        //Set the email service
        const msg = {
            to: user.email,
            from: "suurdledev@gmail.com",
            subject: "Your password has been changed",
            text: "Hello,\n\n" +
                "This is a confirmation that the password for your account " + user.email + " has just been changed.\n"
        };

        await sgMail.send(msg);
        req.flash("success", "Success! Your password has been changed.");
        return res.redirect("/");
    } catch (err) {
        console.error(err);
        if (err.response) {
            console.log(err.response.body);
        }
        req.flash("error", "Sorry, something went wrong, please contact suurdledev@gmail.com");
        return res.redirect("back");
    }
});

//PROFILE - show more info about one user
router.get("/users/:userName", sanitizer, async function(req, res) {
    try {
        //Find user by username
        const foundUser = await User.findOne({username: req.params.userName}).populate("followers assignments").exec();
        if (!foundUser){
            //Handle null result
            req.flash("error", "User not found");
            return res.redirect("back");
        }

        //Render user profile
        return res.render("users/show", { user: foundUser, assignments: foundUser.assignments });
    } catch(err) {
        //Handle error
        req.flash("User not found");
        console.error(err);
        return res.redirect("back");
    }
});
//#TODO: add unfollow
//USER FOLLOW - follow a user
router.get("/users/:userName/follow", sanitizer, isLoggedIn, async function(req, res) {
    try {
        //Find user by username
        const foundUser = await User.findOne({username: req.params.userName}).exec();
        if (!foundUser){
            //Handle null result
            req.flash("error", "User not found");
            return res.redirect("back");
        }
        
        if (foundUser._id == req.user.id) {
            //Handle user trying to follow himself
            req.flash("error", "You cannot follow yourself");
            return res.redirect("back");
        }

        if (!foundUser.followers) {
            //Create field
            foundUser.followers = [];
        } else if (foundUser.followers.includes(req.user._id)) {
            //Handle user trying to follow someone he already follows
            req.flash("error", "You already follow this user");
            return res.redirect("back");
        }

        //Push current user to found user's followers
        foundUser.followers.push(req.user._id);
        //Update user
        await foundUser.save({timestamps: false});
        req.flash("success", "You have successfully followed " + foundUser.username + "!");
        return res.redirect("/users/" + foundUser.username);
    } catch(err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err)
        return res.redirect("back");
    }
});

//NOTIFICATION INDEX - show all notifications of user
router.get("/notifications", sanitizer, isLoggedIn, async function(req, res) {
    try {
        //Find user by id and populate
        const foundUser = await User.findById(req.user._id).populate({
            path: "notifications",
            options: { sort: { "_id": "desc" } }
        }).exec();
        if (!foundUser){
            //Handle null result
            req.flash("error", "User not found");
            return res.redirect("back");
        }

        //Render notifications
        const allNotifications = foundUser.notifications;
        return res.render("notifications/index", { allNotifications });
    } catch(err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("back");
    }
});

//NOTIFICATION SHOW - show more info about one notification
router.get("/notifications/:notificationId", sanitizer, isLoggedIn, async function(req, res) {
    try {
        //Find notification by id
        const foundNotification = await Notification.findById(req.params.notificationId).exec();
        if (!foundNotification){
            //Handle null result
            req.flash("error", "Notification not found");
            return res.redirect("back");
        }

        //Find user by id
        const currentUser = await User.findById(req.user._id).exec();        
        if (!currentUser){
            //Handle null result
            req.flash("error", "User not found");
            return res.redirect("back");
        }

        //Check if user has notification
        if (!currentUser.notifications.includes(foundNotification._id)) {
            //Handle user trying to access someone else's notification
            req.flash("error", "Notification not found"); //User should not know that this id exists
            console.error("User with no access to notification");
            return res.redirect("back");
        }

        //Find the assignment
        const foundAssignment = await Assignment.findById(foundNotification.assignmentId).exec();
        if (!foundAssignment) {
            //Handle null result
            req.flash("error", "Assignment not found");
            return res.redirect("back");
        }
        
        //Set notification as read
        if (!foundNotification.isRead) {
            foundNotification.isRead = true;
            await foundNotification.save();
        }
        //Go to notification's assignment
        return res.redirect(`/assignments/${foundAssignment.slug}`);
    } catch(err) {
        //Handle error
        req.flash("error", "Something went wrong");
        console.error(err);
        return res.redirect("/notifications");
    }
});

module.exports = router;