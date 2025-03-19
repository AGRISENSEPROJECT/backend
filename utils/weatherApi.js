const axios = require('axios');

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

/**
 * Fetches current weather and forecast data from OpenWeatherMap
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} Weather data
 */
async function getWeatherData(lat, lon) {
  try {
    // Get current weather
    const currentWeatherResponse = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`
    );
    
    // Get forecast data
    const forecastResponse = await axios.get(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`
    );

    return {
      current: currentWeatherResponse.data,
      forecast: forecastResponse.data
    };
  } catch (error) {
    console.error('Error fetching weather data:', error.message);
    throw new Error('Failed to fetch weather data');
  }
}

module.exports = {
  getWeatherData
};