const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'

function assertCoordinates(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new Error('A valid latitude and longitude are required for weather data.')
  }
}

function sumLatestHours(values, hours) {
  if (values.length < hours) {
    throw new Error(`Open-Meteo returned fewer than ${hours} hourly precipitation readings.`)
  }

  return Number(values.slice(-hours).reduce((total, value) => total + value, 0).toFixed(1))
}

/**
 * Fetch current conditions plus three days of hourly weather at one point.
 * Open-Meteo does not require an API key for this endpoint.
 */
export async function getWeather(lat, lng) {
  const latitude = Number(lat)
  const longitude = Number(lng)
  assertCoordinates(latitude, longitude)

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: 'precipitation,temperature_2m,weather_code',
    current: 'temperature_2m,weather_code',
    past_days: '3',
    forecast_days: '1',
    timezone: 'auto',
  })

  const response = await fetch(`${OPEN_METEO_FORECAST_URL}?${params.toString()}`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Open-Meteo weather request failed (${response.status}).`)
  }

  const weather = await response.json()
  if (!Array.isArray(weather?.hourly?.time) || !Array.isArray(weather?.hourly?.precipitation)) {
    throw new Error('Open-Meteo returned incomplete hourly precipitation data.')
  }

  return weather
}

/**
 * Sum the most recent completed hourly precipitation readings into the live
 * rainfall features displayed by the Citizen dashboard. Values are in mm.
 */
export async function getRainfallFeatures(lat, lng) {
  const weather = await getWeather(lat, lng)
  const currentTime = weather.current?.time
  const hourlyPrecipitation = weather.hourly.time
    .map((time, index) => ({ time, precipitation: Number(weather.hourly.precipitation[index]) }))
    .filter(({ time, precipitation }) => (!currentTime || time <= currentTime) && Number.isFinite(precipitation))
    .map(({ precipitation }) => precipitation)

  return {
    rainfall_24h_mm: sumLatestHours(hourlyPrecipitation, 24),
    rainfall_72h_mm: sumLatestHours(hourlyPrecipitation, 72),
    temperature_c: Number(weather.current?.temperature_2m),
    weather_code: Number(weather.current?.weather_code),
    observed_at: currentTime || weather.hourly.time.at(-1),
  }
}

export function getWeatherDescription(weatherCode) {
  if ([0].includes(weatherCode)) return 'Clear sky'
  if ([1, 2].includes(weatherCode)) return 'Partly cloudy'
  if ([3].includes(weatherCode)) return 'Overcast'
  if ([45, 48].includes(weatherCode)) return 'Foggy'
  if ([51, 53, 55, 56, 57].includes(weatherCode)) return 'Drizzle'
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) return 'Rain'
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) return 'Snow'
  if ([95, 96, 99].includes(weatherCode)) return 'Thunderstorm'
  return 'Live conditions'
}
