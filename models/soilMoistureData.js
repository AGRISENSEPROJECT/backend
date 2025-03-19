const mongoose = require('mongoose');

const SoilMoistureSchema = new mongoose.Schema({
  location: {
    type: {
      lat: Number,
      lon: Number
    },
    required: true
  },
  soilType: {
    type: String,
    enum: ['SAND', 'LOAM', 'CLAY', 'SILT'],
    default: 'LOAM'
  },
  moisturePercentage: {
    type: Number,
    required: true
  },
  precipitation: {
    type: Number,
    default: 0
  },
  temperature: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient querying by location and time
SoilMoistureSchema.index({ 'location.lat': 1, 'location.lon': 1, timestamp: -1 });

module.exports = mongoose.model('SoilMoisture', SoilMoistureSchema);