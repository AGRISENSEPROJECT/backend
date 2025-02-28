// const passport = require('passport');
// const GoogleStrategy = require('passport-google-oauth20').Strategy;
// const User = require('./models/User');
// const bcrypt = require('bcrypt');
// const { v4: uuidv4 } = require('uuid');
// passport.use(new GoogleStrategy({
//     clientID: process.env.GOOGLE_CLIENT_ID,
//     clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//     callbackURL: "http://localhost:5000/auth/google/callback",
//     scope: ['profile', 'email'],
//     prompt: "consent"
// },
// async (accessToken, refreshToken, profile, done) => {
//     console.log(profile);
//     try {
//         if (!profile.emails || profile.emails.length === 0) {
//             console.error("No email found in profile:", profile);
//             return done(new Error("No email found for this Google account"), null);
//         }

//         const email = profile.emails[0].value;
//         let user = await User.findOne({ email });

//         if (user) {
//             return done(null, user);
//         } else {
//             const username = profile.displayName || email;
//             const password = uuidv4();
//             const hashedPassword = await bcrypt.hash(password, 10);

//             user = new User({
//                 username: username,
//                 email: email,
//                 password: hashedPassword,
//             });

//             await user.save((err) => {
//                 if (err) {
//                     return done(new Error("Error saving the new user to the database"), null);
//                 }
//                 return done(null, user);
//             });
//         }
//     } catch (error) {
//         console.error(error);
//         return done(error, null);
//     }
// }));
// passport.deserializeUser(async (id, done) => {
//     try {
//         const user = await User.findById(id);
//         done(null, user);
//     } catch (error) {
//         console.error(error);
//         done(error, null);
//     }
// });

// module.exports = passport;



// const passport = require('passport');
// const GoogleStrategy = require('passport-google-oauth20').Strategy;
// const User = require('./models/User');
// const bcrypt = require('bcrypt');
// const { v4: uuidv4 } = require('uuid');

// passport.use(new GoogleStrategy({
//     clientID: process.env.GOOGLE_CLIENT_ID,
//     clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//     callbackURL: "http://localhost:5000/auth/google/callback",
//     scope: ['profile', 'email'],
//     prompt: "consent"
// },
// async (accessToken, refreshToken, profile, done) => {
//     try {
//         if (!profile.emails || profile.emails.length === 0) {
//             return done(new Error("No email found for this Google account"), null);
//         }

//         const email = profile.emails[0].value;
//         let user = await User.findOne({ email });

//         if (user) {
//             return done(null, user);
//         } else {
//             const username = profile.displayName || email;
//             const password = uuidv4();
//             const hashedPassword = await bcrypt.hash(password, 10);

//             user = new User({
//                 username,
//                 email,
//                 password: hashedPassword,
//             });

//             await user.save();
//             return done(null, user);
//         }
//     } catch (error) {
//         return done(error, null);
//     }
// }));

// passport.serializeUser((user, done) => {
//     done(null, user.id);
// });

// passport.deserializeUser(async (id, done) => {
//     try {
//         const user = await User.findById(id);
//         done(null, user);
//     } catch (error) {
//         done(error, null);
//     }
// });

// module.exports = passport;



const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('./models/User');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:5000/auth/google/callback",
    scope: ['profile', 'email'],
    prompt: "consent"
},
async (accessToken, refreshToken, profile, done) => {
    try {
        if (!profile.emails || profile.emails.length === 0) {
            return done(new Error("No email found for this Google account"), null);
        }
        
        const email = profile.emails[0].value;
        let user = await User.findOne({ email });

        if (user) {
            return done(null, user);
        } else {
            const username = profile.displayName || email;
            const password = uuidv4();
            const hashedPassword = await bcrypt.hash(password, 10);
            
            user = new User({
                username,
                email,
                password: hashedPassword,
            });

            await user.save();
            return done(null, user);
        }
    } catch (error) {
        return done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id); 
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

module.exports = passport;
