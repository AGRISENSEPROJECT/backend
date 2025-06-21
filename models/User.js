const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false },
    googleId: { type: String, required: false, unique: true, sparse: true },
    farms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Farm' }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);