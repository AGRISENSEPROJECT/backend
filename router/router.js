const express = require("express");
const { registerUser, loginUser, searchUsers,getAllUserIds } = require("../controllers/userController");
const { sendMessage, getMessages,getMessagesForUser } = require("../controllers/messageController");
const { 
    createPost, getAllPosts, getPostById, updatePost, deletePost, 
    deleteAllPosts, likePost, commentPost, sharePost 
} = require("../controllers/postsController");
const { 
    createGroup, getGroups, getGroupById, addMember, removeMember, deleteGroup 
} = require("../controllers/groupController");
const router = express.Router();

// User routes
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/search", searchUsers);
router.get("/all-users",getAllUserIds);


// Message routes
router.post("/send", sendMessage);
router.get("/messages", getMessages);
router.get("/specific-message",getMessagesForUser);


// Post routes
router.post("/post", createPost);
router.get("/posts", getAllPosts);
router.get("/posts/:id", getPostById);
router.put("/posts/:id", updatePost);
router.delete("/post/:id", deletePost);
router.delete("/posts", deleteAllPosts);
router.post("/posts/:id/like", likePost);
router.post("/posts/:id/comment", commentPost);
router.post("/posts/:id/share", sharePost);


// Group routes
router.post("/create", createGroup);
router.get("/", getGroups);
router.get("/:id", getGroupById);
router.post("/add-member", addMember);
router.post("/remove-member", removeMember);
router.delete("/delete", deleteGroup);

module.exports = router;
