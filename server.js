import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const app  = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

app.post('/api/generate', async (req, res) => {
  const { destination, days, budget, currency, group, month, style, interests } = req.body

  if (!destination) {
    return res.status(400).json({ error: 'Destination is required' })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' })
  }

  // Build prompt on the SERVER — much cleaner
  const prompt = `Create a ${days}-day ${style} travel itinerary for ${destination} in ${month} for ${group} traveler with budget ${budget} ${currency}.${interests ? ' Special interests: ' + interests : ''}

Respond with ONLY a JSON object. No markdown. No explanation. Just the raw JSON.

Use this exact structure:
{
  "destination": "${destination}",
  "tagline": "one line inspiring description",
  "totalDays": ${days},
  "budget": "${budget} ${currency}",
  "style": "${style}",
  "budgetBreakdown": {
    "accommodation": "amount in ${currency}",
    "food": "amount in ${currency}",
    "transport": "amount in ${currency}",
    "activities": "amount in ${currency}",
    "misc": "amount in ${currency}"
  },
  "days": [
    {
      "day": 1,
      "theme": "day theme",
      "dailyBudget": "amount in ${currency}",
      "morning": {
        "activity": "activity name",
        "description": "what to do and why",
        "estimatedCost": "amount in ${currency}"
      },
      "afternoon": {
        "activity": "activity name",
        "description": "what to do and why",
        "estimatedCost": "amount in ${currency}"
      },
      "evening": {
        "activity": "activity name",
        "description": "what to do and why",
        "estimatedCost": "amount in ${currency}"
      }
    }
  ],
  "tips": [
    { "icon": "🚇", "text": "transport tip" },
    { "icon": "💳", "text": "money tip" },
    { "icon": "🌤️", "text": "weather tip" },
    { "icon": "🍽️", "text": "food tip" },
    { "icon": "📱", "text": "app tip" },
    { "icon": "⚠️", "text": "warning tip" }
  ]
}

Include all ${days} days. Use real place names.`

  try {
    console.log(`Generating itinerary for ${destination}...`)

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a travel planning expert. You only respond with valid JSON. Never use markdown. Never add explanations. Only output the raw JSON object.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      })
    })

    if (!groqRes.ok) {
      const errData = await groqRes.json()
      console.error('Groq error:', errData)
      return res.status(groqRes.status).json({
        error: errData.error?.message || 'Groq API error'
      })
    }

    const data    = await groqRes.json()
    const text    = data.choices[0].message.content
    const parsed  = JSON.parse(text)

    console.log(`✅ Itinerary for ${destination} generated!`)
    res.json({ result: parsed })

  } catch (error) {
    console.error('Server error:', error.message)
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', model: 'Groq Llama 3.3 70B', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`
  ✈️  AI Travel Planner Server
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Server:  http://localhost:${PORT}
  Health:  http://localhost:${PORT}/api/health
  Model:   Groq — Llama 3.3 70B
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Press Ctrl+C to stop
  `)
})