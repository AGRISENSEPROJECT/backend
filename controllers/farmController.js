// controllers/farmController.js
const Farm = require('../models/Farm');
const Prediction = require('../models/Prediction');
const User = require('../models/User');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs').promises; // Use promises for async file handling
const path = require('path');

// Configure multer for file uploads
const upload = multer({ 
    storage: multer.memoryStorage(), // Use memory storage instead of disk
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.png', '.jpg', '.jpeg'].includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only .png, .jpg, and .jpeg files are allowed'));
        }
    }
});

const createFarm = async (req, res) => {
    try {
        const { name, lat, lon, soilType } = req.body;
        const userId = req.user.id;
        if (!name || !lat || !lon) {
            return res.status(400).json({ error: 'Name, latitude, and longitude are required' });
        }
        const farm = await Farm.create({ name, owner: userId, location: { lat, lon }, soilType });
        await User.findByIdAndUpdate(userId, { $push: { farms: farm._id } });
        res.status(201).json(farm);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getUserFarms = async (req, res) => {
    try {
        const userId = req.user.id;
        const farms = await Farm.find({ owner: userId });
        res.json(farms);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const uploadSoilImage = async (req, res) => {
    try {
        const { farmId } = req.params;
        const userId = req.user.id;
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'Soil image is required' });
        }
        const farm = await Farm.findById(farmId);
        if (!farm || farm.owner.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized or farm not found' });
        }

        // Convert file buffer to base64
        const imageBuffer = file.buffer;
        const base64Image = imageBuffer.toString('base64');

        // Placeholder environmental data (replace with actual values)
        const temperature = 25.5; // Example, get from weather API or input
        const humidity = 65.0;
        const rainfall = 600.0;
        const nitrogen = 40.0;
        const phosphorus = 20.0;
        const potassium = 30.0;

        const payload = {
            image: base64Image,
            temperature,
            humidity,
            rainfall,
            nitrogen,
            phosphorus,
            potassium
        };

        const response = await axios.post('http://localhost:3000/predict', payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        const predictions = response.data.crop_recommendations;
        const prediction = await Prediction.create({
            farm: farmId,
            soilImage: file.originalname,
            predictions
        });

        res.status(200).json(prediction);
    } catch (err) {
        console.error('Prediction error:', err);
        res.status(500).json({ error: err.message });
    }
};

const getFarmPredictions = async (req, res) => {
    try {
        const { farmId } = req.params;
        const userId = req.user.id;
        const farm = await Farm.findById(farmId);
        if (!farm || farm.owner.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized or farm not found' });
        }
        const predictions = await Prediction.find({ farm: farmId }).sort({ timestamp: -1 });
        res.json(predictions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteFarm = async (req, res) => {
    try {
        const { farmId } = req.params;
        const userId = req.user.id;
        const farm = await Farm.findById(farmId);
        if (!farm || farm.owner.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized or farm not found' });
        }
        await Farm.findByIdAndDelete(farmId);
        await User.findByIdAndUpdate(userId, { $pull: { farms: farmId } });
        await Prediction.deleteMany({ farm: farmId });
        await Post.deleteMany({ farm: farmId });
        await Message.deleteMany({ farm: farmId });
        await SoilMoisture.deleteMany({ farm: farmId });
        res.json({ message: 'Farm and associated data deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};



module.exports = { 
    createFarm, 
    getUserFarms, 
    uploadSoilImage: [upload.single('image'), uploadSoilImage], // Apply multer middleware
    getFarmPredictions, 
    deleteFarm 
};