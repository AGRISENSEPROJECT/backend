const { getWeatherData } = require('../utils/weatherApi');
const { calculateSoilMoisture, estimateInitialSoilMoisture, SOIL_TYPES } = require('../models/soilMostureModel');
const SoilMoistureData = require('../models/soilMoistureData');
const Farm = require('../models/Farm');

async function getAgriWeather(req, res) {
    try {
        const { farmId } = req.query;
        const userId = req.user.id;
        if (!farmId) {
            return res.status(400).json({ error: 'Farm ID is required' });
        }
        const farm = await Farm.findById(farmId);
        if (!farm || farm.owner.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized or farm not found' });
        }
        const { lat, lon } = farm.location;
        const soilType = farm.soilType;
        const weatherData = await getWeatherData(lat, lon);
        const agriWeatherData = await processAgriWeatherData(weatherData, { lat, lon, soilType });
        return res.json({ ...agriWeatherData, farmId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function getSoilMoistureHistory(req, res) {
    try {
        const { farmId, days = 7 } = req.query;
        const userId = req.user.id;
        if (!farmId) {
            return res.status(400).json({ error: 'Farm ID is required' });
        }
        const farm = await Farm.findById(farmId);
        if (!farm || farm.owner.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized or farm not found' });
        }
        const { lat, lon } = farm.location;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));
        const moistureHistory = await SoilMoistureData.find({
            farm: farmId,
            timestamp: { $gte: startDate, $lte: endDate }
        }).sort({ timestamp: 1 });
        const formattedHistory = moistureHistory.map(record => ({
            moisturePercentage: record.moisturePercentage,
            precipitation: record.precipitation,
            temperature: record.temperature,
            timestamp: record.timestamp
        }));
        return res.json({ farmId, location: { lat, lon }, history: formattedHistory });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function processAgriWeatherData(weatherData, options = {}) {
    const { current, forecast } = weatherData;
    const { lat, lon, soilType = 'LOAM', farmId } = options;
    const temperature = current.main.temp;
    const humidity = current.main.humidity;
    const windSpeed = current.wind.speed;
    const precipitation = current.rain?.['1h'] || current.rain?.['3h'] || 0;
    const todayForecasts = forecast.list.slice(0, 8);
    const rainProbabilities = todayForecasts.map(item => item.pop || 0);
    const rainPrediction = Math.round((rainProbabilities.reduce((sum, prob) => sum + prob, 0) / rainProbabilities.length) * 100);
    let soilMoisture;
    try {
        const previousReading = await SoilMoistureData.findOne({ farm: farmId }).sort({ timestamp: -1 });
        if (previousReading) {
            soilMoisture = calculateSoilMoisture(
                previousReading.moisturePercentage,
                precipitation,
                temperature,
                windSpeed,
                humidity,
                soilType
            );
            await new SoilMoistureData({
                farm: farmId,
                location: { lat, lon },
                soilType,
                moisturePercentage: soilMoisture,
                precipitation,
                temperature
            }).save();
        } else {
            const recentWeather = todayForecasts.map(forecast => ({
                temperature: forecast.main.temp,
                precipitation: forecast.rain?.['3h'] || 0
            }));
            soilMoisture = estimateInitialSoilMoisture(recentWeather, soilType);
            await new SoilMoistureData({
                farm: farmId,
                location: { lat, lon },
                soilType,
                moisturePercentage: soilMoisture,
                precipitation,
                temperature
            }).save();
        }
    } catch (error) {
        console.error('Error calculating soil moisture:', error);
        soilMoisture = humidity;
    }
    return {
        soilMoisturePercentage: Math.round(soilMoisture),
        rainPredictionPercentage: rainPrediction,
        temperature,
        humidity,
        windSpeed,
        precipitation,
        cloudCover: current.clouds.all,
        location: current.name,
        country: current.sys.country,
        timestamp: new Date().toISOString()
    };
}

module.exports = { getAgriWeather, getSoilMoistureHistory };
