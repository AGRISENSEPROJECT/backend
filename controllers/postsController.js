const Post = require("../models/Posts");

const createPost = async (req, res) => {
  const post = await Post.create(req.body);
  res.json(post);
};

const getAllPosts = async (req, res) => {
  const posts = await Post.find();
  res.json(posts);
};

const getPostById = async (req, res) => {
  const post = await Post.findById(req.params.id);
  res.json(post);
};

const updatePost = async (req, res) => {
  const post = await Post.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(post);
};

const deletePost = async (req, res) => {
  await Post.findByIdAndDelete(req.params.id);
  res.json({ message: "Post deleted" });
};

const deleteAllPosts = async (req, res) => {
  await Post.deleteMany();
  res.json({ message: "All posts deleted" });
};

const likePost = async (req, res) => {
  const post = await Post.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } }, { new: true });
  res.json(post);
};

const commentPost = async (req, res) => {
  const post = await Post.findByIdAndUpdate(req.params.id, { $inc: { comments: 1 } }, { new: true });
  res.json(post);
};

const sharePost = async (req, res) => {
  const post = await Post.findByIdAndUpdate(req.params.id, { $inc: { shares: 1 } }, { new: true });
  res.json(post);
};

module.exports = {
  createPost,
  getAllPosts,
  getPostById,
  updatePost,
  deletePost,
  deleteAllPosts,
  likePost,
  commentPost,
  sharePost
};
