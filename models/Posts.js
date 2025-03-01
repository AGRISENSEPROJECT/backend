const { Schema, model } = require("mongoose");

const PostSchema = new Schema({
  author: {
    name: String,
    profilePicture: String
  },
  content: String,
  image: String,
  timestamp: { type: Date, default: Date.now },
  likes: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  shares: { type: Number, default: 0 }
});

const Post = model("Post", PostSchema);

module.exports = Post;
