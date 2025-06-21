const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema({
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
    soilImage: { type: String, required: true },
    predictions: [
        {
            crop: { type: String, required: true },
            suitability_score: { type: Number, required: true }, // Add this line
            _id: false // Optional: disable automatic _id if not needed
        }
    ],
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Prediction', predictionSchema);