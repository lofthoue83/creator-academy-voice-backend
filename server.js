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

// Claude Vision card analysis endpoint
app.post('/analyze-card', async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Claude API configuration
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-haiku-20240307',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Dies ist ein Scanner für Katzen-Tarot-Karten. Das sind spezielle Tarot-Karten mit niedlichen Katzen-Charakteren.

                WICHTIG: Jede Karte hat ein Banner/Label am unteren Rand mit dem Kartennamen.

                Bitte schaue dir das Bild an:
                1. Ist es eine Tarot-Karte mit einer Katze und einem Text-Banner unten?
                2. Wenn ja, lies den Text im Banner am unteren Rand der Karte.
                3. Der Text könnte sein wie: "THE MAGICIAN", "PAGE OF CUPS", "THE FOOL", "THE EMPRESS", etc.

                Antworte NUR mit dem exakten Text aus dem Banner (z.B. "THE MAGICIAN" oder "PAGE OF CUPS").

                Wenn es KEINE Katzen-Tarot-Karte ist oder du den Text nicht lesen kannst, antworte mit: "Unbekannt"

                Wenn es eine falsche Karte ist (keine Katze oder kein Banner), antworte mit: "Falsche Karte"

                WICHTIG: Gib NUR den Kartennamen aus dem Banner zurück, nichts anderes!`
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

    const detectedMotif = response.data.content[0].text.trim();

    res.json({
      success: true,
      motif: detectedMotif
    });

  } catch (error) {
    console.error('Claude Vision API error:', error.response?.data || error.message);

    // Fallback für Demo-Zwecke
    const demoMotifs = ['Pik Ass', 'Herz Dame', 'Kreuz König', 'Wasserfall/Natur', 'Karo 9'];
    res.json({
      success: true,
      motif: demoMotifs[Math.floor(Math.random() * demoMotifs.length)],
      demo: true
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