const Assignment = require("./models/assignment");
const Comment = require("./models/comment");
const Domain = require("./models/domain");
const Notification = require("./models/notification");
const Subject = require("./models/subject");
const User = require("./models/user");
const Vote = require("./models/vote");
const faker = require("faker");

const adminPwd = process.env.ADMIN_PWD || "admin";
if (!process.env.ADMIN_PWD)
    console.warn("Using the failback seed admin password. Please set your seed admin password as the environmental variable ADMIN_PWD")

const admin = {
    username: "admin",
    email: "admin@suurdle.com",
    firstName: "The",
    lastName: "Admin",
    isAdmin: "true"
}

const nUsers = {
    min: 5,
    max: 10,
}
nUsers.current = nUsers.min + Math.random()*(nUsers.max-nUsers.min+1) + 1;

const nDomains = {
    min: 2,
    max: 5,
    current: 0,
    newCurrent: function() {this.current = this.min + Math.random()*(this.max-this.min);}
}

const nSubjects = {
    min: 5,
    max: 10,
    current: 0,
    newCurrent: function() {this.current = this.min + Math.random()*(this.max-this.min);}
}

const nAssignments = {
    min: 10,
    max: 30,
    current: 0,
    newCurrent: function() {this.current = this.min + Math.random()*(this.max-this.min);}
}
const nComments = {
    min: 1,
    max: 3,
    current: 0,
    newCurrent: function() {this.current = this.min + Math.random()*(this.max-this.min);}
}
const nVotes = {
    min: 0,
    max: nUsers.current,
    current: 0,
    newCurrent: function() {this.current = this.min + Math.random()*(this.max-this.min);}
}
const nFollowers = {
    min: 0,
    max: nUsers.current - 1,
    current: 0,
    newCurrent: function() {this.current = this.min + Math.random()*(this.max-this.min);}
}

async function seedDB(){
    try {
        if (process.env.STAGE != "Development") {
            console.warn("You are trying to seed the DB outside of a development environment. If you are on a development environment please set your environmental variable STAGE to Development");
            return;
        }
        //Generate list of unique emails
        let email = new Set();
        for (let i = 0; i < nUsers.current; i++) {
            let added = false;
            while (!added) {
                el = faker.internet.email();
                if (!email.has(el)) {
                    email.add(el);
                    added = true;
                }
            }
        }
        email = Array.from(email);

        //Generate list of unique usernames
        let username = new Set();
        for (let i = 0; i < nUsers.current; i++) {
            let added = false;
            while (!added) {
                el = faker.internet.userName();
                if (!username.has(el)) {
                    username.add(el);
                    added = true;
                }
            }
        }
        username = Array.from(username);

        //Generate list of users
        let users = [];
        for (let i = 0; i < nUsers.current; i++) {
            users.push({
                username: username[i],
                email: email[i],
                firstName: faker.name.firstName(),
                lastName: faker.name.lastName()
            });
        }

        //Generate list of domains
        let domains = [];
        nDomains.newCurrent();
        for (let i = 0; i < nDomains.current; i++) {
            domains.push({
                name: faker.lorem.words()
            });
        }

        //Generate list of subjects
        let subjects = [];
        nSubjects.newCurrent();
        for (let i = 0; i < nSubjects.current; i++) {
            subjects.push({
                name: faker.lorem.words()
            });
        }

        //Generate list of assignments
        let assignments = [];
        nAssignments.newCurrent();
        for (let i = 0; i < nAssignments.current; i++) {
            assignments.push({
                title: faker.lorem.sentence(),
                description: faker.lorem.paragraphs(Math.random()*10)
            });
        }

        //Remove all users
        const removeUsers = await User.find({});
        for (const user of removeUsers) {
            await user.remove();
        }
        console.log("Removed all users");

        //Remove all domains
        const removeDomains = await Domain.find({});
        for (const domain of removeDomains) {
            await domain.remove();
        }
        console.log("Removed all domains");

        //Remove all subjects
        const removeSubjects = await Subject.find({});
        for (const subject of removeSubjects) {
            await subject.remove();
        }
        console.log("Removed all subjects");

        //Remove all assignments
        const removeAssignments = await Assignment.find({});
        for (const assignment of removeAssignments) {
            await assignment.remove();
        }
        console.log("Removed all assignments");

        //Remove all comments
        const removeComments = await Comment.find({});
        for (const comment of removeComments) {
            await comment.remove();
        }
        console.log("Removed all comments");

        //Remove all notifications
        const removeNotifications = await Notification.find({});
        for (const notification of removeNotifications) {
            await notification.remove();
        }
        console.log("Removed all notifications");

        //Remove all notifications
        const removeVotes = await Vote.find({});
        for (const vote of removeVotes) {
            await vote.remove();
        }
        console.log("Removed all votes");

        //ADDING                
        //Add admin
        await User.register(admin, adminPwd);
        console.log("Added admin");

        //Add users
        console.log(`Adding ${users.length} users`);
        const createdUsers = await User.create(users);
        if ( createdUsers.length != users.length) {
            //Handle not all users created
            console.log("Failed to create all users");
            return;
        }            
        console.log(`Added ${createdUsers.length} users`);       

        //Set remaining domains fields
        for (let i = 0; i < domains.length; i++) {
            //Set a random author from users
            const rndUser = Math.floor(Math.random()*createdUsers.length);
            domains[i].creator = createdUsers[rndUser]._id;
        }

        console.log(`Adding ${domains.length} domains`);
        const createdDomains = await Domain.create(domains);
        if (createdDomains.length != domains.length) {
            //Handle not all domains created
            console.log("Failed to create all domains");
            return;
        }
        console.log(`Added ${createdDomains.length} domains`);  

        //Set remaining subjects fields
        for (let i = 0; i < subjects.length; i++) {
            //Set a random author from users
            const rndUser = Math.floor(Math.random()*createdUsers.length);
            const rndDomain = Math.floor(Math.random()*createdDomains.length);
            subjects[i].creator = createdUsers[rndUser];
            subjects[i].domain = createdDomains[rndDomain]._id;
        }
        
        console.log(`Adding ${subjects.length} subjects`);
        const createdSubjects = await Subject.create(subjects);
        if (createdSubjects.length != subjects.length) {
            //Handle not all subjects created
            console.log("Failed to create all subjects");
            return;
        }
        console.log(`Added ${createdSubjects.length} subjects`);  

        //#TODO: create assignments per subject

        //Set remaining assignments fields
        for (let i = 0; i < assignments.length; i++) {
            //Set a random author from users
            const rndUser = Math.floor(Math.random()*createdUsers.length);
            const rndSubject = Math.floor(Math.random()*createdSubjects.length);
            assignments[i].author = createdUsers[rndUser].username;
            assignments[i].subject = createdSubjects[rndSubject]._id;
        }
        //Add assignments
        console.log(`Adding ${assignments.length} assignments`);
        const createdAssignments = await Assignment.create(assignments);
        if (createdAssignments.length != assignments.length){
            //Handle not all assignments created
            console.log("Failed to create all assignments");
            return;
        }        
        console.log(`Added ${createdAssignments.length} assignments`);

        for (const [i, assignmentCreated] of createdAssignments.entries()) {
            //Add votes
            let assignmentVotes = [];
            const rnd = Math.floor(Math.random()*createdUsers.length);
            nVotes.newCurrent();
            for (let i = 0; i < nVotes.current && rnd+i < createdUsers.length; i++) {                
                assignmentVotes.push({user: createdUsers[rnd+i].username, upvote: (Math.random() > 0.5), modelId: assignmentCreated._id, modelName: "Assignment"});
            }
            console.log(`Adding ${assignmentVotes.length} votes to assignment (${i+1} of ${createdAssignments.length})`);
            const createdAssignmentVotes = await Vote.create(assignmentVotes);
            if (createdAssignmentVotes.length != assignmentVotes.length){
                //Handle not all votes created
                console.log("Failed to create all votes");
                return;
            } 
            console.log(`Added ${assignmentVotes.length} votes to assignment (${i+1} of ${createdAssignments.length})`);
            assignmentCreated.score = assignmentVotes.filter(vote => vote.upvote).length - assignmentVotes.filter(vote => !vote.upvote).length;
            assignmentCreated.save({timestamps: false});

            //Add comments
            let comments = [];
            nComments.newCurrent();
            for (let i = 0; i < nComments.current; i++) {
                const rnd = Math.floor(Math.random()*createdUsers.length);
                comments.push({
                    text: faker.lorem.sentence(),
                    author: createdUsers[rnd].username,
                    modelId: assignmentCreated._id,
                    modelName: "Assignment"
                });
            }

            console.log(`Adding ${comments.length} comments to assignment (${i+1} of ${createdAssignments.length})`);
            const createdComments = await Comment.create(comments);
            if (createdComments.length != comments.length){
                //Handle not all comments created
                console.log("Failed to create all comments");
                return;
            }

            
            
            for (const [i, commentCreated] of createdComments.entries()) {
                //Add votes
                let commentVotes = [];
                const rnd = Math.floor(Math.random()*createdUsers.length);
                nVotes.newCurrent();
                for (let i = 0; i < nVotes.current && rnd+i < createdUsers.length; i++) {                
                    commentVotes.push({user: createdUsers[rnd+i].username, upvote: (Math.random() > 0.5), modelId: commentCreated._id, modelName: "Comment"});
                }
                console.log(`Adding ${commentVotes.length} votes to comment (${i+1} of ${createdComments.length})`);
                const createdCommentVotes = await Vote.create(commentVotes);
                if (createdCommentVotes.length != commentVotes.length){
                    //Handle not all votes created
                    console.log("Failed to create all votes");
                    return;
                } 
                console.log(`Added ${commentVotes.length} votes to comment (${i+1} of ${createdComments.length})`);
                commentCreated.score = commentVotes.filter(vote => vote.upvote).length - commentVotes.filter(vote => !vote.upvote).length;
                commentCreated.save({timestamps: false});
                
                //Add replies
                let replies = [];
                nComments.newCurrent();
                for (let i = 0; i < nComments.current/2; i++) {
                    const rnd = Math.floor(Math.random()*createdUsers.length);
                    replies.push({
                        text: faker.lorem.sentence(),
                        author: createdUsers[rnd].username,
                        modelId: commentCreated._id,
                        modelName: "Comment"
                    });
                }
                
                console.log(`Adding ${replies.length} replies to comment (${i+1} of ${createdComments.length})`);
                const createdReplies = await Comment.create(replies);
                if (createdReplies.length != replies.length){
                    //Handle not all replies created
                    console.log("Failed to create all replies");
                    return;
                }
                console.log(`Added ${createdReplies.length} replies to comment (${i+1} of ${createdComments.length})`);

                for (const [i, replyCreated] of createdReplies.entries()) {
                    //Add votes
                    let replyVotes = [];
                    const rnd = Math.floor(Math.random()*createdUsers.length);
                    nVotes.newCurrent();
                    for (let i = 0; i < nVotes.current && rnd+i < createdUsers.length; i++) {                
                        replyVotes.push({user: createdUsers[rnd+i].username, upvote: (Math.random() > 0.5), modelId: replyCreated._id, modelName: "Comment"});
                    }
                    console.log(`Adding ${replyVotes.length} votes to reply (${i+1} of ${createdReplies.length})`);
                    const createdReplyVotes = await Vote.create(replyVotes);
                    if (createdReplyVotes.length != replyVotes.length){
                        //Handle not all votes created
                        console.log("Failed to create all votes");
                        return;
                    } 
                    console.log(`Added ${replyVotes.length} votes to reply (${i+1} of ${createdReplies.length})`);
                    replyCreated.score = replyVotes.filter(vote => vote.upvote).length - replyVotes.filter(vote => !vote.upvote).length;
                    replyCreated.save({timestamps: false});
                }

            }

            console.log(`Added ${createdComments.length} comments to assignment (${i+1} of ${createdAssignments.length})`);
        }
    } catch (err) {
        //Handle error
        console.error(err);
    }
}

module.exports = seedDB;
