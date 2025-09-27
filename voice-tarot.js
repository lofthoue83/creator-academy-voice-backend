const { fal } = require('@fal-ai/client');

// Configure fal.ai API key - only use FAL_API_KEY, not RUNPOD
const FAL_API_KEY = process.env.FAL_API_KEY;
if (FAL_API_KEY) {
  fal.config({
    credentials: FAL_API_KEY
  });
} else {
  console.error('FAL_API_KEY is not set!');
}

class VoiceTarotService {
  constructor() {
    this.modelId = 'fal-ai/minimax/speech-02-hd';
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

      console.log('Generating voice with fal.ai MiniMax Speech-02 HD...');
      console.log('Text length:', prompt.length, 'characters');

      // Limit to 5000 characters for fal.ai
      const textToSpeak = prompt.substring(0, 5000);

      // Use fal.ai to generate speech
      const result = await fal.subscribe(this.modelId, {
        input: {
          text: textToSpeak,
          // Voice settings for mystical effect
          voice_setting: {
            speed: voiceStyle === 'mystical' ? 0.9 : 1.0,
            volume: 1.0,
            pitch: voiceStyle === 'mystical' ? -2 : 0
          },
          audio_setting: {
            sample_rate: 48000,
            bitrate: 128,
            channel: 2
          }
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === 'IN_PROGRESS') {
            console.log('Generating audio...');
          }
        }
      });

      console.log('fal.ai response received');

      // Check if we got audio
      if (result && result.audio_url) {
        return {
          audioUrl: result.audio_url,
          text: prompt,
          duration: result.duration || 30,
          jobId: result.request_id || 'fal-job'
        };
      } else if (result && result.audio) {
        // If audio is returned as base64
        const audioUrl = `data:audio/mp3;base64,${result.audio}`;
        return {
          audioUrl: audioUrl,
          text: prompt,
          duration: result.duration || 30,
          jobId: result.request_id || 'fal-job'
        };
      }

      // Fallback to text-only
      return {
        audioUrl: null,
        text: prompt,
        duration: 30,
        jobId: 'fallback',
        message: 'Audio konnte nicht generiert werden. Hier ist der Text deiner Lesung:'
      };

    } catch (error) {
      console.error('fal.ai TTS error:');
      console.error('Error message:', error.message);

      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }

      // Return text-only version on error
      return {
        audioUrl: null,
        text: this.createTarotPrompt(cards, spreadType),
        duration: 30,
        jobId: 'error',
        message: 'Audio konnte nicht generiert werden. Hier ist der Text deiner Lesung:',
        debugError: error.message
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
   * Stream audio in real-time (not used with fal.ai)
   */
  async streamAudio(jobId) {
    // fal.ai handles streaming internally
    return null;
  }

  /**
   * Get available voices (not applicable for MiniMax)
   */
  async getAvailableVoices() {
    return ['default'];
  }
}

module.exports = VoiceTarotService;