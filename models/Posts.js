const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema({
    author: {
        name: String,
        profilePicture: String
    },
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
    content: String,
    image: String,
    timestamp: { type: Date, default: Date.now },
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares: { type: Number, default: 0 }
});

module.exports = mongoose.model('Post', PostSchema);
