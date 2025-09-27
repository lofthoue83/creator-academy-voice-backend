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
      console.log('API Key present:', !!RUNPOD_API_KEY);

      // For now, return a mock response for testing
      // TODO: Implement actual RunPod Chatterbox API call when properly configured

      // Temporary solution: Use text-only response
      return {
        audioUrl: null, // No audio yet
        text: prompt,
        duration: 30,
        jobId: 'mock-job-id',
        message: 'Voice generation wird noch konfiguriert. Hier ist der Text für deine Lesung:'
      };

      /* Actual RunPod implementation - uncomment when API is ready:
      const response = await axios.post(
        `${this.baseUrl}/runsync`,
        {
          input: {
            text: prompt,
            voice_settings: {
              style: voiceStyle,
              language: 'de',
              speed: 0.95,
              pitch: 1.0
            },
            output_format: 'mp3',
            stream: true
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${RUNPOD_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        audioUrl: response.data.output.audio_url,
        text: response.data.output.text,
        duration: response.data.output.duration,
        jobId: response.data.id
      };
      */

    } catch (error) {
      console.error('Voice generation error:', error.response?.data || error.message);
      throw error;
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