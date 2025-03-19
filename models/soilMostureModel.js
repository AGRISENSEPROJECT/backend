/**
 * Soil Moisture Model
 * 
 * This model estimates soil moisture based on weather parameters and soil characteristics.
 * It uses a simple water balance approach: Moisture = Previous Moisture + Precipitation - Evapotranspiration
 */

// Soil type coefficients (water retention capacity)
const SOIL_TYPES = {
    SAND: { fieldCapacity: 0.15, wiltingPoint: 0.05, drainageRate: 0.6 },
    LOAM: { fieldCapacity: 0.30, wiltingPoint: 0.12, drainageRate: 0.4 },
    CLAY: { fieldCapacity: 0.40, wiltingPoint: 0.20, drainageRate: 0.2 },
    SILT: { fieldCapacity: 0.35, wiltingPoint: 0.15, drainageRate: 0.3 }
  };
  
  // Default to loam if soil type is unknown
  const DEFAULT_SOIL_TYPE = 'LOAM';
  
  /**
   * Calculate potential evapotranspiration using Hargreaves equation
   * @param {number} tempC - Temperature in Celsius
   * @param {number} windSpeed - Wind speed in m/s
   * @param {number} humidity - Relative humidity (0-100)
   * @returns {number} Potential evapotranspiration in mm/day
   */
  function calculateEvapotranspiration(tempC, windSpeed, humidity) {
    // Simple version of Hargreaves equation
    // ET = 0.0023 × (Tmean + 17.8) × (Tmax - Tmin)^0.5 × Ra
    // We'll use a simplified approach since we don't have all parameters
    
    // Adjust for wind and humidity effects
    const windFactor = 1 + (windSpeed * 0.05); // Wind increases evaporation
    const humidityFactor = 1 - (humidity / 200); // Higher humidity reduces evaporation
    
    // Base evapotranspiration rate based on temperature
    // Roughly 2-7mm/day depending on temperature
    const baseET = 2 + (tempC * 0.2);
    
    return Math.max(0, baseET * windFactor * humidityFactor);
  }
  
  /**
   * Calculate soil moisture based on previous moisture, precipitation, and evapotranspiration
   * @param {number} previousMoisture - Previous soil moisture percentage (0-100)
   * @param {number} precipitation - Precipitation in mm
   * @param {number} tempC - Temperature in Celsius
   * @param {number} windSpeed - Wind speed in m/s
   * @param {number} humidity - Relative humidity (0-100)
   * @param {string} soilType - Soil type (SAND, LOAM, CLAY, SILT)
   * @returns {number} Updated soil moisture percentage (0-100)
   */
  function calculateSoilMoisture(
    previousMoisture, 
    precipitation, 
    tempC, 
    windSpeed, 
    humidity, 
    soilType = DEFAULT_SOIL_TYPE
  ) {
    // Convert percentage to decimal
    const prevMoistureFraction = previousMoisture / 100;
    
    // Get soil parameters
    const soil = SOIL_TYPES[soilType] || SOIL_TYPES[DEFAULT_SOIL_TYPE];
    
    // Calculate evapotranspiration in mm/day
    const et = calculateEvapotranspiration(tempC, windSpeed, humidity);
    
    // Calculate water balance
    // Assume a standard soil depth of 30cm for calculation
    const soilDepthMm = 300; // 30cm = 300mm
    
    // Convert moisture fraction to mm of water
    const prevWaterMm = prevMoistureFraction * soilDepthMm;
    
    // Add precipitation, subtract evapotranspiration
    let newWaterMm = prevWaterMm + precipitation - et;
    
    // Apply drainage for excess water above field capacity
    const fieldCapacityMm = soil.fieldCapacity * soilDepthMm;
    if (newWaterMm > fieldCapacityMm) {
      const excessWater = newWaterMm - fieldCapacityMm;
      const drainage = excessWater * soil.drainageRate;
      newWaterMm -= drainage;
    }
    
    // Ensure water doesn't go below wilting point or above field capacity
    const wiltingPointMm = soil.wiltingPoint * soilDepthMm;
    newWaterMm = Math.max(wiltingPointMm, Math.min(fieldCapacityMm, newWaterMm));
    
    // Convert back to percentage
    const newMoistureFraction = newWaterMm / soilDepthMm;
    const newMoisturePercentage = newMoistureFraction * 100;
    
    // Normalize to 0-100 scale
    const normalizedMoisture = ((newMoisturePercentage - (soil.wiltingPoint * 100)) / 
                               ((soil.fieldCapacity * 100) - (soil.wiltingPoint * 100))) * 100;
    
    return Math.max(0, Math.min(100, normalizedMoisture));
  }
  
  /**
   * Estimate initial soil moisture based on recent weather conditions
   * @param {Array} recentWeather - Array of recent weather data points
   * @param {string} soilType - Soil type
   * @returns {number} Estimated initial soil moisture percentage
   */
  function estimateInitialSoilMoisture(recentWeather, soilType = DEFAULT_SOIL_TYPE) {
    // If no recent weather, assume middle of range
    if (!recentWeather || recentWeather.length === 0) {
      const soil = SOIL_TYPES[soilType] || SOIL_TYPES[DEFAULT_SOIL_TYPE];
      return ((soil.fieldCapacity + soil.wiltingPoint) / 2) * 100;
    }
    
    // Calculate based on recent precipitation and temperature patterns
    let totalPrecip = 0;
    let avgTemp = 0;
    
    recentWeather.forEach(weather => {
      totalPrecip += weather.precipitation || 0;
      avgTemp += weather.temperature || 0;
    });
    
    avgTemp /= recentWeather.length;
    
    // Simple heuristic: more rain and lower temps = higher moisture
    const soil = SOIL_TYPES[soilType] || SOIL_TYPES[DEFAULT_SOIL_TYPE];
    const baseLevel = ((soil.fieldCapacity + soil.wiltingPoint) / 2) * 100;
    
    // Adjust based on recent precipitation (each mm adds about 1% up to field capacity)
    const precipFactor = Math.min(totalPrecip * 1, (soil.fieldCapacity - soil.wiltingPoint) * 100);
    
    // Adjust based on temperature (higher temps reduce moisture)
    const tempFactor = Math.max(0, (20 - avgTemp) * 0.5);
    
    return Math.min(100, Math.max(0, baseLevel + precipFactor + tempFactor));
  }
  
  module.exports = {
    calculateSoilMoisture,
    estimateInitialSoilMoisture,
    SOIL_TYPES
  };