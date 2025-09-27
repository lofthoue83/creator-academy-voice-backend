const axios = require('axios');

// RunPod Chatterbox Configuration
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || 'YOUR_RUNPOD_KEY';
const CHATTERBOX_ENDPOINT = process.env.CHATTERBOX_ENDPOINT || 'chatterbox-tts';

class VoiceTarotService {
  constructor() {
    this.baseUrl = `https://api.runpod.ai/v2/${CHATTERBOX_ENDPOINT}`;
  }

  /**
   * Generate voice tarot reading from detected cards
   * @param {Array} cards - Array of detected card names
   * @param {String} spreadType - Type of tarot spread (cross, three-card, etc)
   * @param {String} voiceStyle - Voice style (mystical, calm, energetic)
   * @returns {Object} Audio stream and text
   */
  async generateVoiceReading(cards, spreadType = 'three-card', voiceStyle = 'mystical') {
    try {
      // Create tarot-specific prompt
      const prompt = this.createTarotPrompt(cards, spreadType);

      console.log('Generating voice with RunPod API...');
      console.log('Endpoint:', this.baseUrl);
      console.log('Full URL:', `${this.baseUrl}/runsync`);
      console.log('API Key (first 10 chars):', RUNPOD_API_KEY ? RUNPOD_API_KEY.substring(0, 10) : 'NOT SET');

      const requestBody = {
        input: {
          text: prompt.substring(0, 500), // Limit text for testing
          model: "tts-1",
          voice: "nova",
          response_format: "mp3",
          speed: 0.9
        }
      };

      console.log('Request body:', JSON.stringify(requestBody, null, 2));

      // Active RunPod implementation with correct endpoint
      const response = await axios.post(
        `${this.baseUrl}/runsync`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${RUNPOD_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        }
      );

      console.log('RunPod response status:', response.status);
      console.log('RunPod response headers:', response.headers);
      console.log('RunPod response data:', JSON.stringify(response.data, null, 2));

      // Check if we got a direct response from runsync
      if (response.data) {
        // For runsync, the output is directly in the response
        if (response.data.output) {
          // If output contains base64 audio
          if (response.data.output.audio_base64) {
            // Convert base64 to data URL for playback
            const audioUrl = `data:audio/mp3;base64,${response.data.output.audio_base64}`;
            return {
              audioUrl: audioUrl,
              text: prompt,
              duration: response.data.output.duration || 30,
              jobId: response.data.id || 'sync-job'
            };
          }
          // If output contains audio URL
          else if (response.data.output.audio_url) {
            return {
              audioUrl: response.data.output.audio_url,
              text: prompt,
              duration: response.data.output.duration || 30,
              jobId: response.data.id || 'sync-job'
            };
          }
        }

        // If response has different structure (job ID for async)
        if (response.data.id && !response.data.output) {
          // Wait and poll for result
          await new Promise(resolve => setTimeout(resolve, 2000));

          const statusResponse = await axios.get(
            `${this.baseUrl}/status/${response.data.id}`,
            {
              headers: {
                'Authorization': `Bearer ${RUNPOD_API_KEY}`
              }
            }
          );

          console.log('Status response:', statusResponse.data);

          if (statusResponse.data && statusResponse.data.output) {
            return {
              audioUrl: statusResponse.data.output.audio_url || null,
              text: prompt,
              duration: statusResponse.data.output.duration || 30,
              jobId: response.data.id
            };
          }
        }
      }

      // Fallback to text-only
      return {
        audioUrl: null,
        text: prompt,
        duration: 30,
        jobId: response.data?.id || 'unknown',
        message: 'Audio-Generierung läuft noch. Hier ist der Text deiner Lesung:'
      };

    } catch (error) {
      console.error('Voice generation error:');
      console.error('Error message:', error.message);

      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        console.error('Response headers:', error.response.headers);
      } else if (error.request) {
        console.error('No response received. Request:', error.request);
      } else {
        console.error('Error setting up request:', error.message);
      }

      // Return text-only version on error
      return {
        audioUrl: null,
        text: this.createTarotPrompt(cards, spreadType),
        duration: 30,
        jobId: 'error',
        message: 'Audio konnte nicht generiert werden. Hier ist der Text deiner Lesung:',
        debugError: error.response?.data || error.message
      };
    }
  }

  /**
   * Create mystical tarot reading prompt
   */
  createTarotPrompt(cards, spreadType) {
    const cardDescriptions = {
      'THE FOOL': 'Neue Anfänge und unbegrenztes Potenzial erwarten dich',
      'THE MAGICIAN': 'Du hast alle Werkzeuge, die du brauchst, um deine Ziele zu erreichen',
      'THE HIGH PRIESTESS': 'Vertraue deiner Intuition und inneren Weisheit',
      'THE EMPRESS': 'Fruchtbarkeit und Kreativität fließen durch dein Leben',
      'THE EMPEROR': 'Struktur und Disziplin werden dir Erfolg bringen',
      'THE LOVERS': 'Wichtige Entscheidungen in der Liebe stehen bevor',
      'THE ICEBEAR': 'Stärke in der Einsamkeit, Zeit für innere Reflexion',
      'THE UNICORN': 'Magie und Reinheit umgeben dich, folge deinen Träumen',
      // Add more card meanings...
    };

    let reading = `Willkommen zu deiner mystischen Tarot-Lesung. `;
    reading += `Ich habe ${cards.length} Karten für dich gezogen. `;
    reading += `Lass uns sehen, was das Universum dir mitteilen möchte.\n\n`;

    // Three-card spread
    if (spreadType === 'three-card' && cards.length >= 3) {
      reading += `Die erste Karte repräsentiert deine Vergangenheit: ${cards[0]}. `;
      reading += cardDescriptions[cards[0]] || 'Diese Karte birgt Geheimnisse.';
      reading += `\n\n`;

      reading += `Die zweite Karte zeigt deine Gegenwart: ${cards[1]}. `;
      reading += cardDescriptions[cards[1]] || 'Der gegenwärtige Moment ist voller Möglichkeiten.';
      reading += `\n\n`;

      reading += `Die dritte Karte enthüllt deine Zukunft: ${cards[2]}. `;
      reading += cardDescriptions[cards[2]] || 'Die Zukunft formt sich durch deine Handlungen.';
    }

    // Celtic Cross
    else if (spreadType === 'celtic-cross' && cards.length >= 5) {
      reading += `Im Zentrum steht ${cards[0]} - dies ist deine aktuelle Situation.\n`;
      reading += `Gekreuzt von ${cards[1]} - dies ist deine Herausforderung.\n`;
      reading += `Über dir schwebt ${cards[2]} - dein bewusstes Ziel.\n`;
      reading += `Unter dir liegt ${cards[3]} - deine unbewusste Basis.\n`;
      reading += `Die Zukunft zeigt ${cards[4]} - das mögliche Ergebnis.\n`;
    }

    // Single card
    else {
      reading += `Deine Karte ist ${cards[0]}. `;
      reading += cardDescriptions[cards[0]] || 'Diese Karte spricht zu deiner Seele.';
    }

    reading += `\n\nMöge diese Lesung dir Klarheit und Führung bringen. Namaste.`;

    return reading;
  }

  /**
   * Stream audio in real-time
   */
  async streamAudio(jobId) {
    const streamUrl = `${this.baseUrl}/stream/${jobId}`;

    try {
      const response = await axios.get(streamUrl, {
        headers: {
          'Authorization': `Bearer ${RUNPOD_API_KEY}`
        },
        responseType: 'stream'
      });

      return response.data;
    } catch (error) {
      console.error('Streaming error:', error);
      throw error;
    }
  }

  /**
   * Get available voices
   */
  async getAvailableVoices() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/voices`,
        {
          headers: {
            'Authorization': `Bearer ${RUNPOD_API_KEY}`
          }
        }
      );

      return response.data.voices;
    } catch (error) {
      console.error('Error fetching voices:', error);
      return [];
    }
  }
}

module.exports = VoiceTarotService;