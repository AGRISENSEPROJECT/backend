const mongoose = require('mongoose');

const SoilMoistureSchema = new mongoose.Schema({
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
    location: {
        lat: Number,
        lon: Number
    },
    soilType: {
        type: String,
        enum: ['SAND', 'LOAM', 'CLAY', 'SILT'],
        default: 'LOAM'
    },
    moisturePercentage: { type: Number, required: true },
    precipitation: { type: Number, default: 0 },
    temperature: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now }
});

SoilMoistureSchema.index({ 'location.lat': 1, 'location.lon': 1, timestamp: -1 });

module.exports = mongoose.model('SoilMoisture', SoilMoistureSchema);
