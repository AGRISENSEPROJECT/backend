require('dotenv').config();
const express = require('express');
const connectDB=require('./configurations/configurations.js');
const cors = require('cors');
const http = require('http');
const session = require('express-session');
const passport = require('./passport');
const { Server } = require('socket.io');
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
const routers = require('./router/router');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.use(cors());
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

// Swagger API Documentation
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
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerJSDoc(swaggerOptions)));

// Authentication Routes
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

// Routes
app.use("/", routers);

// Socket.io for real-time messaging
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    socket.on('sendMessage', (data) => io.emit('receiveMessage', data));
    socket.on('disconnect', () => console.log('User disconnected:', socket.id));
});

connectDB();
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
