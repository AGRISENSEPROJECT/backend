// require('dotenv').config();

// const express = require('express');
// const app = express();
// const port = process.env.PORT || 3000;
// const routers = require('./router/router');
// const connectDB = require('./config');
// const passport = require("./passport");
// const session = require('express-session');

// app.use(session({
//   secret: process.env.SESSION_SECRET,
//   resave: false,
//   saveUninitialized: true
// }));

// app.use(passport.initialize());
// app.use(passport.session());

// app.get('/auth/google', passport.authenticate('google', {
//   scope: ['https://www.googleapis.com/auth/plus.email']
// }));

// app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
//   res.redirect('/profile');
// });

// app.get('/profile', (req, res) => {
//   if (!req.isAuthenticated()) {
//       return res.redirect('/');
//   }
//   res.send(`Hello, ${req.user.username}`);
// });

// app.get('/logout', (req, res) => {
//   req.logout(() => {
//       res.redirect('/');
//   });
// });

// app.use(express.json());
// app.use("/", routers);
// app.get('/', (req, res) => {
//   res.send('Hello, nelson!');
// });

// connectDB();
// app.listen(port, () => {
//   console.log(`server running successfully`);
// });



require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const routers = require('./router/router');
const connectDB = require('./config');
const passport = require("./passport");
const session = require('express-session');

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

app.get('/auth/google', passport.authenticate('google', {
  scope: ['openid', 'email', 'profile']
}));

app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
  res.redirect('/profile');
});

app.get('/profile', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/');
  }
  res.send(`Hello, ${req.user.username}`);
});

app.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/');
  });
});

app.use(express.json());
app.use("/", routers);

app.get('/', (req, res) => {
  res.send('Hello, nelson!');
});

connectDB();

app.listen(port, () => {
  console.log(`server running successfully on port ${port}`);
});
