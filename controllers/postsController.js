const Post = require('../models/Posts');
const Farm = require('../models/Farm');

const createPost = async (req, res) => {
    try {
        const { content, image, farmId } = req.body;
        const userId = req.user.id;
        if (!farmId) {
            return res.status(400).json({ error: 'Farm ID is required' });
        }
        const farm = await Farm.findById(farmId);
        if (!farm || farm.owner.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized or farm not found' });
        }
        const post = await Post.create({
            author: { name: req.user.username, profilePicture: req.user.profilePicture || '' },
            content,
            image,
            farm: farmId
        });
        res.json(post);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getAllPosts = async (req, res) => {
    try {
        const userId = req.user.id;
        const farms = await Farm.find({ owner: userId }).select('_id');
        const farmIds = farms.map(farm => farm._id);
        const posts = await Post.find({ farm: { $in: farmIds } });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getPostById = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        const userId = req.user.id;
        const farm = await Farm.findById(post.farm);
        if (!post || !farm || farm.owner.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized or post not found' });
        }
        res.json(post);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updatePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        const userId = req.user.id;
        const farm = await Farm.findById(post.farm);
        if (!post || !farm || farm.owner.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized or post not found' });
        }
        const updatedPost = await Post.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updatedPost);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deletePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        const userId = req.user.id;
        const farm = await Farm.findById(post.farm);
        if (!post || !farm || farm.owner.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized or post not found' });
        }
        await Post.findByIdAndDelete(req.params.id);
        res.json({ message: 'Post deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteAllPosts = async (req, res) => {
    try {
        const userId = req.user.id;
        const farms = await Farm.find({ owner: userId }).select('_id');
        const farmIds = farms.map(farm => farm._id);
        await Post.deleteMany({ farm: { $in: farmIds } });
        res.json({ message: 'All posts deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const likePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        const userId = req.user.id;
        const farm = await Farm.findById(post.farm);
        if (!post || !farm || farm.owner.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized or post not found' });
        }
        const updatedPost = await Post.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } }, { new: true });
        res.json(updatedPost);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const commentPost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        const userId = req.user.id;
        const farm = await Farm.findById(post.farm);
        if (!post || !farm || farm.owner.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized or post not found' });
        }
        const updatedPost = await Post.findByIdAndUpdate(req.params.id, { $inc: { comments: 1 } }, { new: true });
        res.json(updatedPost);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const sharePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        const userId = req.user.id;
        const farm = await Farm.findById(post.farm);
        if (!post || !farm || farm.owner.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized or post not found' });
        }
        const updatedPost = await Post.findByIdAndUpdate(req.params.id, { $inc: { shares: 1 } }, { new: true });
        res.json(updatedPost);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { createPost, getAllPosts, getPostById, updatePost, deletePost, deleteAllPosts, likePost, commentPost, sharePost };