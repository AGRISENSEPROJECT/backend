const mongoose = require("mongoose");
const groupSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: false },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Group', groupSchema);
