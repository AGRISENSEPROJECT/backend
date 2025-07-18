const express = require('express');
const { registerUser, loginUser, searchUsers, getAllUserIds } = require('../controllers/userController');
const { sendMessage, getMessages, getMessagesForUser } = require('../controllers/messageController');
const { createPost, getAllPosts, getPostById, updatePost, deletePost, deleteAllPosts, likePost, commentPost, sharePost } = require('../controllers/postsController');
const { createGroup, getGroups, getGroupById, addMember, removeMember, deleteGroup } = require('../controllers/groupController');
const { getAgriWeather, getSoilMoistureHistory } = require('../controllers/weatherController');
const { createFarm, getUserFarms, getFarmPredictions, uploadSoilImage, deleteFarm } = require('../controllers/farmController');
const authenticate = require('../middleware/authenticate');
const router = express.Router();

// User routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/search', authenticate, searchUsers);
router.get('/all-users', authenticate, getAllUserIds);

// Farm routes
router.post('/farms', authenticate, createFarm);
router.get('/farms', authenticate, getUserFarms);
router.post('/farms/:farmId/predict', authenticate, uploadSoilImage);
router.get('/farms/:farmId/predict', authenticate, getFarmPredictions);
router.delete('/farms/:farmId', authenticate, deleteFarm);

// Message routes
router.post('/send', authenticate, sendMessage);
router.get('/messages', authenticate, getMessages);
router.get('/specific-message', authenticate, getMessagesForUser);

// Post routes
router.post('/post', authenticate, createPost);
router.get('/posts', authenticate, getAllPosts);
router.get('/posts/:id', authenticate, getPostById);
router.put('/posts/:id', authenticate, updatePost);
router.delete('/post/:id', authenticate, deletePost);
router.delete('/posts', authenticate, deleteAllPosts);
router.post('/posts/:id/like', authenticate, likePost);
router.post('/posts/:id/comment', authenticate, commentPost);
router.post('/posts/:id/share', authenticate, sharePost);

// Group routes
router.post('/create', authenticate, createGroup);
router.get('/', authenticate, getGroups);
router.get('/:id', authenticate, getGroupById);
router.post('/add-member', authenticate, addMember);
router.post('/remove-member', authenticate, removeMember);
router.delete('/delete', authenticate, deleteGroup);

// Weather routes
router.get('/weather', authenticate, getAgriWeather);
router.get('/weather/soil-moisture/history', authenticate, getSoilMoistureHistory);

module.exports = router;