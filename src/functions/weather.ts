import fetch from 'node-fetch'

type FunctionInput = {
  body: {
    location: string
  }
}

export const handler = async (event: FunctionInput): Promise<any> => {
  try {
    console.log(event)

    // Fetch secret (weather API key) from the secrets manager
    const secretUrl =
      'http://localhost:2773/secretsmanager/get?secretId=smalltalk-weather'
    const secretResponse = await fetch(secretUrl, {
      method: 'GET',
      headers: {
        'X-Aws-Parameters-Secrets-Token': process.env.AWS_SESSION_TOKEN!,
      },
    })

    if (!secretResponse.ok) {
      throw new Error(
        `Error occured while requesting secret. Status: ${secretResponse.status}`
      )
    }
    const { SecretString } = (await secretResponse.json()) as {
      SecretString: string
    }

    // Get coordinates
    const coordinatesUrl = `http://api.openweathermap.org/geo/1.0/direct?q=${event.body.location}&limit=1&appid=${SecretString}`
    const coordinatesResponse = await fetch(coordinatesUrl)

    if (!coordinatesResponse.ok) {
      throw new Error(
        `Error occured while requesting coordinates. Status: ${coordinatesResponse.status}`
      )
    }

    const coordinates = (await coordinatesResponse.json()) as {
      lat: number
      lon: number
    }[]
    if (!coordinates.length) {
      throw new Error('No coordinates found')
    }
    const { lat, lon } = coordinates[0]

    // Get weather
    const weatherUrl = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&units=imperial&exclude=minutely,hourly,daily,alerts&appid=${SecretString}`
    const weatherResponse = await fetch(weatherUrl)
    if (!weatherResponse.ok) {
      throw new Error(
        `Error occured while requesting weather. Status: ${weatherResponse.status}`
      )
    }

    const weather = (await weatherResponse.json()) as any

    return {
      Body: {
        ...weather.current,
        location: { name: event.body.location, lat, lon },
      },
    }
  } catch (error) {
    console.log('Error', error)

    if (error instanceof Error) {
      throw new Error(`${error.message}`)
    }

    throw new Error('Unknown error ocurred')
  }
}
