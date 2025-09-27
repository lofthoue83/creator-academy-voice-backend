require('dotenv').config();

const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

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
app.post('/analyze-card', async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Claude API configuration
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    // Enhanced prompt for better recognition
    const cardAnalysisPrompt = `Dies ist ein Scanner für Katzen-Tarot-Karten. Das sind spezielle Tarot-Karten mit niedlichen Katzen-Charakteren.

WICHTIG: Jede Karte hat ein goldenes/gelbes Banner am unteren Rand mit dem Kartennamen in GROßBUCHSTABEN.

Analysiere das Bild systematisch:
1. Siehst du eine Karte mit einem goldenen/gelben Banner am unteren Rand?
2. Der Banner-Text ist IMMER in Großbuchstaben geschrieben
3. Lies den Text im Banner genau - häufige Karten sind:
   - Major Arcana: THE FOOL, THE MAGICIAN, THE HIGH PRIESTESS, THE EMPRESS, THE EMPEROR, THE HIEROPHANT, THE LOVERS, THE CHARIOT, STRENGTH, THE HERMIT, WHEEL OF FORTUNE, JUSTICE, THE HANGED MAN, DEATH, TEMPERANCE, THE DEVIL, THE TOWER, THE STAR, THE MOON, THE SUN, JUDGEMENT, THE WORLD
   - Spezielle Karten: THE ICEBEAR
   - Court Cards: PAGE OF CUPS, KNIGHT OF CUPS, QUEEN OF CUPS, KING OF CUPS (auch für WANDS, SWORDS, PENTACLES)
   - Aces: ACE OF CUPS, ACE OF WANDS, ACE OF SWORDS, ACE OF PENTACLES

WICHTIG:
- Römische Zahlen auf der Karte (wie XIX) sind NICHT der Kartenname
- Der Kartenname steht IMMER im goldenen Banner unten
- Antworte NUR mit dem exakten Text aus dem Banner

Wenn du den Text nicht klar lesen kannst oder unsicher bist, antworte mit: "Unbekannt"
Wenn es keine Tarot-Karte ist, antworte mit: "Falsche Karte"`;

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

        // Check if we got a valid result
        if (result && result !== 'UNBEKANNT' && result !== 'FALSCHE KARTE') {
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
      res.json({
        success: true,
        motif: detectedMotif,
        modelUsed: modelUsed,
        cached: false
      });
    } else {
      // No models could recognize the card
      res.json({
        success: true,
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

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'Payment backend running',
    endpoints: {
      createPaymentIntent: 'POST /create-payment-intent',
      webhook: 'POST /webhook',
      analyzeCard: 'POST /analyze-card'
    }
  });
});

app.listen(PORT, () => {
  console.log(`Payment backend running on http://localhost:${PORT}`);
});