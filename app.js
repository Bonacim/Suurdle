require('dotenv').config();
const express = require("express");
const app = express();
const bodyParser= require("body-parser");
const mongoose = require("mongoose");
const flash= require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const methodOverride= require("method-override");
const User = require("./models/user");
const expressSanitizer = require("express-sanitizer");
const seedDB = require("./seeds");
//#TODO: style domains/subjects/assignments to look different
//Requiring routes
const commentRoutes = require("./routes/comments");
const assignmentRoutes = require("./routes/assignments");
const subjectRoutes = require("./routes/subjects");
const domainRoutes = require("./routes/domains");
const indexRoutes = require("./routes/index");
//#TODO: better tab indexes
const url = process.env.DATABASEURL || "mongodb://localhost:27017/suurdle";
mongoose.connect(url, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(()=>console.log("Connected to DB!")
).catch((err)=>console.error(err));
mongoose.set("useCreateIndex", true);

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(methodOverride("_method"));
app.use(flash());
app.use(expressSanitizer());
app.locals.moment = require("moment");
// seedDB(); //!!!DELETES ALL THE DB and seed it, should remove it before deployment
//#TODO: check if required fields are filled
//#TODO: better search, fields for description, tags, author
//#TODO: sort querys

// PASSPORT CONFIGURATION
const session = require("express-session");
const MongoStore = require("connect-mongo")(session);
const secret = process.env.SESSION_SECRET || "failback"
if (!process.env.SESSION_SECRET)
console.warn("Using the failback secret. Please set your secret as the environmental variable SESSION_SECRET")

app.use(session({
    secret: secret,
    resave: false,
    saveUninitialized: false,
    store: new MongoStore({ mongooseConnection: mongoose.connection }),
    cookie: { maxAge: 180 * 60 * 1000 } // 180 minutes session expiration
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
//#TODO: let creator delete domain/subject if it's empty
//#TODO: create official email and associate services with it (atlas, cloudinary, sendgrid)
//#TODO: remove link from navbar related to current page
//#TODO: add report buttons
//#TODO: add admin dashboard
const cloudinary = require("cloudinary");
cloudinary.config({ 
    cloud_name: "suurdle-dev", 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
});

app.use(async function(req, res, next){
    //Set user
    res.locals.currentUser = req.user;
    if(req.user) {
        try {
            //Find user and populate notifications
            const user = await User.findById(req.user._id).populate("notifications", null, { isRead: false }).exec();
            res.locals.notifications = user.notifications.reverse();
        } catch (err) {
            //Handle error
            console.error(err);
        }
    }    
    
    //Check for slash at the end of URL
    if (req.path.substr(-1) === "/" && req.path.length > 1) {
        //Remove slash at the end of URL
        const query = req.url.slice(req.path.length);
        return res.redirect(307, req.path.slice(0, -1) + query);
    }
    
    //Get flash messages
    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success");
    return next();
});

app.use("/", indexRoutes);
app.use("/domains", domainRoutes);
app.use("/domains/:domainSlug/subjects", subjectRoutes);
app.use("/domains/:domainSlug/subjects/:subjectSlug/assignments", assignmentRoutes);
app.use("/domains/:domainSlug/subjects/:subjectSlug/assignments/:assignmentSlug/comments", commentRoutes);


const port = process.env.PORT || 3000;
app.listen(port, process.env.IP, function(){
    console.log("The Suurdle Server Has Started!");
});