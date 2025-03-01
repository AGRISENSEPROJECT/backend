const express = require("express");
const { registerUser, loginUser } = require("../controllers/userController");
const {
  createPost,
  getAllPosts,
  getPostById,
  updatePost,
  deletePost,
  deleteAllPosts,
  likePost,
  commentPost,
  sharePost
} = require("../controllers/postsController");

const router = express.Router();

/**
 * @swagger
 * /register:
 *   post:
 *     description: Register a new user
 *     parameters:
 *       - name: username
 *         in: body
 *         required: true
 *         type: string
 *       - name: email
 *         in: body
 *         required: true
 *         type: string
 *       - name: password
 *         in: body
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: User registered successfully
 *       400:
 *         description: Invalid input data
 */
router.post("/register", registerUser);

/**
 * @swagger
 * /login:
 *   post:
 *     description: Log in an existing user
 *     parameters:
 *       - name: email
 *         in: body
 *         required: true
 *         type: string
 *       - name: password
 *         in: body
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: User logged in successfully
 *       401:
 *         description: Invalid email or password
 */
router.post("/login", loginUser);

/**
 * @swagger
 * /post:
 *   post:
 *     description: Create a new post
 *     parameters:
 *       - name: title
 *         in: body
 *         required: true
 *         type: string
 *       - name: content
 *         in: body
 *         required: true
 *         type: string
 *     responses:
 *       201:
 *         description: Post created successfully
 *       400:
 *         description: Invalid input data
 */
router.post("/post", createPost);

/**
 * @swagger
 * /posts:
 *   get:
 *     description: Get all posts
 *     responses:
 *       200:
 *         description: List of all posts
 */
router.get("/posts", getAllPosts);

/**
 * @swagger
 * /posts/{id}:
 *   get:
 *     description: Get a post by ID
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: Post found
 *       404:
 *         description: Post not found
 */
router.get("/posts/:id", getPostById);

/**
 * @swagger
 * /posts/{id}:
 *   put:
 *     description: Update a post by ID
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         type: string
 *       - name: title
 *         in: body
 *         required: false
 *         type: string
 *       - name: content
 *         in: body
 *         required: false
 *         type: string
 *     responses:
 *       200:
 *         description: Post updated successfully
 *       404:
 *         description: Post not found
 */
router.put("/posts/:id", updatePost);

/**
 * @swagger
 * /post/{id}:
 *   delete:
 *     description: Delete a post by ID
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: Post deleted successfully
 *       404:
 *         description: Post not found
 */
router.delete("/post/:id", deletePost);

/**
 * @swagger
 * /posts:
 *   delete:
 *     description: Delete all posts
 *     responses:
 *       200:
 *         description: All posts deleted successfully
 */
router.delete("/posts", deleteAllPosts);

/**
 * @swagger
 * /posts/{id}/like:
 *   post:
 *     description: Like a post by ID
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: Post liked successfully
 *       404:
 *         description: Post not found
 */
router.post("/posts/:id/like", likePost);

/**
 * @swagger
 * /posts/{id}/comment:
 *   post:
 *     description: Comment on a post by ID
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         type: string
 *       - name: comment
 *         in: body
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: Comment added successfully
 *       404:
 *         description: Post not found
 */
router.post("/posts/:id/comment", commentPost);

/**
 * @swagger
 * /posts/{id}/share:
 *   post:
 *     description: Share a post by ID
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: Post shared successfully
 *       404:
 *         description: Post not found
 */
router.post("/posts/:id/share", sharePost);

module.exports = router;
