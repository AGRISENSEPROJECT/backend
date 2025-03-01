require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const routers = require('./router/router');
const connectDB = require('./config');
const passport = require("./passport");
const session = require('express-session');
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Agrisense API",
      version: "1.0.0",
      description: "API documentation for Agrisense application",
    },
  },
  apis: ["./router/*.js"], 
};

// Initialize Swagger documentation
const swaggerDocs = swaggerJSDoc(swaggerOptions);

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

// Swagger UI route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.get('/', (req, res) => {
  res.send('Hello, nelson!');
});

connectDB();

app.listen(port, () => {
  console.log(`server running successfully on port ${port}`);
});
