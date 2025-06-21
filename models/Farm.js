const mongoose = require('mongoose');

const farmSchema = new mongoose.Schema({
    name: { type: String, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    location: {
        lat: { type: Number, required: true },
        lon: { type: Number, required: true }
    },
    soilType: {
        type: String,
        enum: ['SAND', 'LOAM', 'CLAY', 'SILT'],
        default: 'LOAM'
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Farm', farmSchema);