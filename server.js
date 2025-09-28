require('dotenv').config();

const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');
const VoiceTarotService = require('./voice-tarot');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Voice Tarot Service
const voiceTarot = new VoiceTarotService();

// Increase payload size limit for base64 images
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Create payment intent endpoint
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency, metadata } = req.body;
    
    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // Amount in cents
      currency: currency || 'eur',
      metadata: metadata || {},
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook endpoint for Stripe events
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = 'whsec_YOUR_WEBHOOK_SECRET'; // TODO: Replace with your webhook secret

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log(`PaymentIntent was successful: ${paymentIntent.id}`);
      // TODO: Fulfill the purchase, unlock content, etc.
      break;
    
    case 'payment_intent.payment_failed':
      const failedIntent = event.data.object;
      console.log(`Payment failed: ${failedIntent.id}`);
      break;
    
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// Claude Vision card analysis endpoint with retry mechanism
// Debug endpoint to check environment
app.get('/debug-env', (req, res) => {
  res.json({
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    keyLength: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.length : 0,
    keyPrefix: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.substring(0, 10) + '...' : 'NOT SET',
    hasFalKey: !!process.env.FAL_API_KEY,
    hasWavespeedKey: !!process.env.WAVESPEED_API_KEY,
    wavespeedKeyLength: process.env.WAVESPEED_API_KEY ? process.env.WAVESPEED_API_KEY.length : 0,
    nodeEnv: process.env.NODE_ENV
  });
});

app.post('/analyze-card', async (req, res) => {
  try {
    const { imageBase64, mode = 'single' } = req.body; // mode: 'single' or 'multiple'

    if (!imageBase64) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Claude API configuration
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    // Choose prompt based on mode
    let cardAnalysisPrompt;

    if (mode === 'multiple') {
      // Prompt for multiple cards
      cardAnalysisPrompt = `AUFGABE: Erkenne ALLE Katzen-Tarot-Karten im Bild.

Diese Katzen-Tarot-Karten haben IMMER ein goldenes/gelbes Banner mit schwarzem Text am unteren Rand.

ANLEITUNG:
1. Schaue das GESAMTE Bild an und zähle wie viele Karten du siehst
2. Für JEDE Karte: Finde das goldene Banner am unteren Rand
3. Lies den Text in JEDEM Banner von LINKS nach RECHTS

WICHTIG:
- Es können 1-5 Karten im Bild sein
- Lies sie in der Reihenfolge: Von links nach rechts, dann von oben nach unten
- Jede Karte hat IMMER ein goldenes Banner am unteren Rand

Mögliche Kartennamen:
- Major Arcana: THE FOOL, THE MAGICIAN, THE HIGH PRIESTESS, THE EMPRESS, THE EMPEROR, THE HIEROPHANT, THE LOVERS, THE CHARIOT, STRENGTH, THE HERMIT, WHEEL OF FORTUNE, JUSTICE, THE HANGED MAN, DEATH, TEMPERANCE, THE DEVIL, THE TOWER, THE STAR, THE MOON, THE SUN, JUDGEMENT, THE WORLD
- Spezielle: THE ICEBEAR, THE UNICORN
- Court Cards: PAGE/KNIGHT/QUEEN/KING OF CUPS/WANDS/SWORDS/PENTACLES
- Aces: ACE OF CUPS/WANDS/SWORDS/PENTACLES

ANTWORTFORMAT:
- Bei 2 Karten: "KARTE1, KARTE2" (z.B. "THE UNICORN, THE ICEBEAR")
- Bei 3 Karten: "KARTE1, KARTE2, KARTE3"
- Bei 5 Karten: "OBEN: KARTE1, LINKS: KARTE2, MITTE: KARTE3, RECHTS: KARTE4, UNTEN: KARTE5"

Antworte NUR mit den Kartennamen, getrennt durch Kommas.`;
    } else {
      // Original single card prompt
      cardAnalysisPrompt = `AUFGABE: Lies NUR den Text im goldenen Banner am unteren Rand der Karte.

Diese Katzen-Tarot-Karten haben IMMER ein goldenes/gelbes Banner mit schwarzem Text am unteren Rand.

SCHRITT 1: Schaue ZUERST nur auf den unteren Rand der Karte
SCHRITT 2: Dort ist ein goldenes/gelbes Banner mit schwarzem Text
SCHRITT 3: Lies NUR diesen Text im Banner - nichts anderes!

Der Text im Banner ist IMMER einer dieser Namen:
- Major Arcana: THE FOOL, THE MAGICIAN, THE HIGH PRIESTESS, THE EMPRESS, THE EMPEROR, THE HIEROPHANT, THE LOVERS, THE CHARIOT, STRENGTH, THE HERMIT, WHEEL OF FORTUNE, JUSTICE, THE HANGED MAN, DEATH, TEMPERANCE, THE DEVIL, THE TOWER, THE STAR, THE MOON, THE SUN, JUDGEMENT, THE WORLD
- Spezielle Karten: THE ICEBEAR, THE UNICORN
- Court Cards: PAGE/KNIGHT/QUEEN/KING OF CUPS/WANDS/SWORDS/PENTACLES
- Aces: ACE OF CUPS/WANDS/SWORDS/PENTACLES

IGNORIERE:
- Alle anderen Texte auf der Karte
- Römische Zahlen (wie XIX)
- Das Bild selbst

FOKUSSIERE DICH NUR AUF: Das goldene Banner am unteren Rand!

Antworte NUR mit dem exakten Text aus dem Banner (z.B. "THE UNICORN").
Bei Unsicherheit: "Unbekannt"`;
    }

    // Model hierarchy for retry mechanism
    const models = [
      { name: 'claude-3-haiku-20240307', maxTokens: 100 },
      { name: 'claude-3-5-sonnet-20241022', maxTokens: 100 },
      { name: 'claude-3-opus-20240229', maxTokens: 100 }
    ];

    let detectedMotif = null;
    let modelUsed = null;

    // Try each model in sequence until we get a valid result
    for (let i = 0; i < models.length; i++) {
      const model = models[i];

      try {
        console.log(`Trying model: ${model.name}`);

        const response = await axios.post(
          'https://api.anthropic.com/v1/messages',
          {
            model: model.name,
            max_tokens: model.maxTokens,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: cardAnalysisPrompt
                  },
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: 'image/jpeg',
                      data: imageBase64
                    }
                  }
                ]
              }
            ]
          },
          {
            headers: {
              'x-api-key': ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json'
            }
          }
        );

        const result = response.data.content[0].text.trim().toUpperCase();

        // Valid tarot cards list
        const validTarotCards = [
          "THE FOOL", "THE MAGICIAN", "THE HIGH PRIESTESS", "THE EMPRESS",
          "THE EMPEROR", "THE HIEROPHANT", "THE LOVERS", "THE CHARIOT",
          "STRENGTH", "THE HERMIT", "WHEEL OF FORTUNE", "JUSTICE",
          "THE HANGED MAN", "DEATH", "TEMPERANCE", "THE DEVIL",
          "THE TOWER", "THE STAR", "THE MOON", "THE SUN",
          "JUDGEMENT", "THE WORLD", "THE ICEBEAR", "THE UNICORN",
          "ACE OF CUPS", "TWO OF CUPS", "THREE OF CUPS", "FOUR OF CUPS",
          "FIVE OF CUPS", "SIX OF CUPS", "SEVEN OF CUPS", "EIGHT OF CUPS",
          "NINE OF CUPS", "TEN OF CUPS", "PAGE OF CUPS", "KNIGHT OF CUPS",
          "QUEEN OF CUPS", "KING OF CUPS",
          "ACE OF WANDS", "TWO OF WANDS", "THREE OF WANDS", "FOUR OF WANDS",
          "FIVE OF WANDS", "SIX OF WANDS", "SEVEN OF WANDS", "EIGHT OF WANDS",
          "NINE OF WANDS", "TEN OF WANDS", "PAGE OF WANDS", "KNIGHT OF WANDS",
          "QUEEN OF WANDS", "KING OF WANDS",
          "ACE OF SWORDS", "TWO OF SWORDS", "THREE OF SWORDS", "FOUR OF SWORDS",
          "FIVE OF SWORDS", "SIX OF SWORDS", "SEVEN OF SWORDS", "EIGHT OF SWORDS",
          "NINE OF SWORDS", "TEN OF SWORDS", "PAGE OF SWORDS", "KNIGHT OF SWORDS",
          "QUEEN OF SWORDS", "KING OF SWORDS",
          "ACE OF PENTACLES", "TWO OF PENTACLES", "THREE OF PENTACLES", "FOUR OF PENTACLES",
          "FIVE OF PENTACLES", "SIX OF PENTACLES", "SEVEN OF PENTACLES", "EIGHT OF PENTACLES",
          "NINE OF PENTACLES", "TEN OF PENTACLES", "PAGE OF PENTACLES", "KNIGHT OF PENTACLES",
          "QUEEN OF PENTACLES", "KING OF PENTACLES"
        ];

        // Check if result is a valid tarot card name
        const isValidCard = validTarotCards.includes(result);

        // Check if we got a valid result
        if (result && result !== 'UNBEKANNT' && result !== 'FALSCHE KARTE' && isValidCard) {
          detectedMotif = result;
          modelUsed = model.name;
          console.log(`Success with ${model.name}: ${detectedMotif}`);
          break;
        } else if (i === 0 && (result === 'UNBEKANNT' || result === 'FALSCHE KARTE')) {
          // If first model says it's not a card or unknown, try next model
          console.log(`First model returned ${result}, trying next model...`);
          continue;
        } else {
          // If even better models can't recognize it, accept the result
          detectedMotif = result;
          modelUsed = model.name;
          break;
        }

      } catch (modelError) {
        console.error(`Error with model ${model.name}:`, modelError.response?.data || modelError.message);
        // Continue to next model if current one fails
        if (i < models.length - 1) {
          continue;
        }
        throw modelError;
      }
    }

    // If we got a result, return it
    if (detectedMotif) {
      // Parse multiple cards if in multiple mode
      if (mode === 'multiple') {
        const cards = detectedMotif.split(',').map(card => card.trim());
        res.json({
          success: true,
          mode: 'multiple',
          cards: cards,
          motif: detectedMotif, // Keep for backwards compatibility
          modelUsed: modelUsed,
          cached: false
        });
      } else {
        res.json({
          success: true,
          mode: 'single',
          motif: detectedMotif,
          modelUsed: modelUsed,
          cached: false
        });
      }
    } else {
      // No models could recognize the card
      res.json({
        success: true,
        mode: mode,
        motif: 'Unbekannt',
        modelUsed: 'none',
        cached: false
      });
    }

  } catch (error) {
    console.error('Claude Vision API error:', error.response?.data || error.message);

    // Return error instead of demo fallback
    res.status(500).json({
      success: false,
      error: 'Fehler bei der Kartenerkennung. Bitte versuchen Sie es erneut.',
      details: error.message
    });
  }
});

// Voice Tarot Reading endpoint
app.post('/generate-voice-reading', async (req, res) => {
  try {
    const {
      cards,
      spreadType = 'three-card',
      voiceStyle = 'mystical',
      userName = 'Lena',  // User's name for personalization
      friends = ['Max', 'Sophie', 'Julian', 'Emma']  // User's friends for magical roles
    } = req.body;

    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ error: 'No cards provided' });
    }

    // Determine spread type based on card count
    let actualSpreadType = spreadType;
    if (cards.length === 5) {
      actualSpreadType = 'five-card';
    } else if (cards.length >= 3) {
      actualSpreadType = 'three-card';
    }

    // Generate voice reading with personalization
    const result = await voiceTarot.generateVoiceReading(
      cards,
      actualSpreadType,
      voiceStyle,
      { userName, friends }  // Pass personalization data
    );

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Voice generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate voice reading',
      details: error.message
    });
  }
});

// Stream audio endpoint
app.get('/stream-audio/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const audioStream = await voiceTarot.streamAudio(jobId);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');

    audioStream.pipe(res);

  } catch (error) {
    console.error('Streaming error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stream audio',
      details: error.message
    });
  }
});

// Get available voices endpoint
app.get('/available-voices', async (req, res) => {
  try {
    const voices = await voiceTarot.getAvailableVoices();

    res.json({
      success: true,
      voices: voices
    });

  } catch (error) {
    console.error('Error fetching voices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available voices',
      details: error.message
    });
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'Payment backend running',
    endpoints: {
      createPaymentIntent: 'POST /create-payment-intent',
      webhook: 'POST /webhook',
      analyzeCard: 'POST /analyze-card',
      generateVoiceReading: 'POST /generate-voice-reading',
      streamAudio: 'GET /stream-audio/:jobId',
      availableVoices: 'GET /available-voices'
    }
  });
});

app.listen(PORT, () => {
  console.log(`Payment backend running on http://localhost:${PORT}`);
});