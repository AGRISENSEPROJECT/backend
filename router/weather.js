const express = require('express');
const router = express.Router();
const { getAgriWeather, getSoilMoistureHistory } = require('../controllers/weatherController');

// GET /api/weather?lat=XX&lon=YY&soilType=LOAM
router.get('/', getAgriWeather);

// GET /api/weather/soil-moisture/history?lat=XX&lon=YY&days=7
router.get('/soil-moisture/history', getSoilMoistureHistory);

module.exports = router;