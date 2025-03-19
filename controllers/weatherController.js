const { getWeatherData } = require('../utils/weatherApi');
const { 
  calculateSoilMoisture, 
  estimateInitialSoilMoisture, 
  SOIL_TYPES 
} = require('../models/soilMostureModel');
const SoilMoistureData = require('../models/soilMoistureData');

/**
 * Process weather data to extract agricultural metrics
 * @param {Object} weatherData - Raw weather data from API
 * @param {Object} options - Additional options
 * @returns {Object} Processed agricultural weather metrics
 */
async function processAgriWeatherData(weatherData, options = {}) {
  const { current, forecast } = weatherData;
  const { lat, lon, soilType = 'LOAM' } = options;
  
  // Current weather data
  const temperature = current.main.temp;
  const humidity = current.main.humidity;
  const windSpeed = current.wind.speed;
  
  // Extract precipitation from recent data (last 24h)
  // OpenWeatherMap provides precipitation as 'rain.3h' in mm for 3-hour intervals
  const precipitation = current.rain?.['1h'] || current.rain?.['3h'] || 0;
  
  // Rain prediction for today
  const todayForecasts = forecast.list.slice(0, 8); // Next 24 hours (3-hour intervals)
  const rainProbabilities = todayForecasts.map(item => item.pop || 0);
  const rainPrediction = Math.round(
    (rainProbabilities.reduce((sum, prob) => sum + prob, 0) / rainProbabilities.length) * 100
  );
  
  // Calculate soil moisture
  let soilMoisture;
  
  // Try to get previous soil moisture reading from database
  if (lat && lon) {
    try {
      // Find the most recent soil moisture reading for this location
      const previousReading = await SoilMoistureData.findOne({
        'location.lat': { $gte: lat - 0.01, $lte: lat + 0.01 },
        'location.lon': { $gte: lon - 0.01, $lte: lon + 0.01 }
      }).sort({ timestamp: -1 });
      
      if (previousReading) {
        // Calculate new soil moisture based on previous reading
        soilMoisture = calculateSoilMoisture(
          previousReading.moisturePercentage,
          precipitation,
          temperature,
          windSpeed,
          humidity,
          soilType
        );
        
        // Save the new reading
        await new SoilMoistureData({
          location: { lat, lon },
          soilType,
          moisturePercentage: soilMoisture,
          precipitation,
          temperature
        }).save();
      } else {
        // No previous reading, estimate initial soil moisture
        // Get recent weather data for estimation
        const recentWeather = todayForecasts.map(forecast => ({
          temperature: forecast.main.temp,
          precipitation: forecast.rain?.['3h'] || 0
        }));
        
        soilMoisture = estimateInitialSoilMoisture(recentWeather, soilType);
        
        // Save the initial reading
        await new SoilMoistureData({
          location: { lat, lon },
          soilType,
          moisturePercentage: soilMoisture,
          precipitation,
          temperature
        }).save();
      }
    } catch (error) {
      console.error('Error calculating soil moisture:', error);
      // Fallback to using humidity as a proxy if database operations fail
      soilMoisture = humidity;
    }
  } else {
    // No location provided, use humidity as a proxy
    soilMoisture = humidity;
  }
  
  // Additional useful agricultural data
  const cloudCover = current.clouds.all;
  
  return {
    soilMoisturePercentage: Math.round(soilMoisture),
    rainPredictionPercentage: rainPrediction,
    temperature: temperature,
    humidity: humidity,
    windSpeed: windSpeed,
    precipitation: precipitation,
    cloudCover: cloudCover,
    location: current.name,
    country: current.sys.country,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get agricultural weather data for a location
 */
async function getAgriWeather(req, res) {
  try {
    const { lat, lon, soilType } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ 
        error: 'Missing required parameters: lat and lon' 
      });
    }
    
    const weatherData = await getWeatherData(lat, lon);
    const agriWeatherData = await processAgriWeatherData(weatherData, { 
      lat: parseFloat(lat), 
      lon: parseFloat(lon),
      soilType: soilType && SOIL_TYPES[soilType.toUpperCase()] ? soilType.toUpperCase() : 'LOAM'
    });
    
    return res.json(agriWeatherData);
  } catch (error) {
    console.error('Weather controller error:', error);
    return res.status(500).json({ 
      error: 'Failed to process weather data',
      details: error.message 
    });
  }
}

/**
 * Get soil moisture history for a location
 */
async function getSoilMoistureHistory(req, res) {
  try {
    const { lat, lon, days = 7 } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ 
        error: 'Missing required parameters: lat and lon' 
      });
    }
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Query database for soil moisture history
    const moistureHistory = await SoilMoistureData.find({
      'location.lat': { $gte: parseFloat(lat) - 0.01, $lte: parseFloat(lat) + 0.01 },
      'location.lon': { $gte: parseFloat(lon) - 0.01, $lte: parseFloat(lon) + 0.01 },
      timestamp: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: 1 });
    
    // Format the response
    const formattedHistory = moistureHistory.map(record => ({
      moisturePercentage: record.moisturePercentage,
      precipitation: record.precipitation,
      temperature: record.temperature,
      timestamp: record.timestamp
    }));
    
    return res.json({
      location: { lat: parseFloat(lat), lon: parseFloat(lon) },
      history: formattedHistory
    });
  } catch (error) {
    console.error('Soil moisture history error:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve soil moisture history',
      details: error.message 
    });
  }
}

module.exports = {
  getAgriWeather,
  getSoilMoistureHistory
};
