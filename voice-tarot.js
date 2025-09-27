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

      // Use fal.ai to generate speech with correct format
      const result = await fal.subscribe(this.modelId, {
        input: {
          text: textToSpeak,
          voice_setting: {
            voice_id: voiceStyle === 'mystical' ? 'Wise_Woman' : 'Deep_Voice_Man',
            speed: voiceStyle === 'mystical' ? 0.8 : 1.0,  // Noch langsamer für mystisch
            vol: 1.0,
            pitch: voiceStyle === 'mystical' ? -3 : 0,    // Tiefere Stimme
            emotion: voiceStyle === 'mystical' ? 'neutral' : 'happy'  // Emotionen: happy, sad, angry, fearful, disgusted, surprised, neutral
          },
          audio_setting: {
            sample_rate: 32000,    // Must be integer from allowed values
            bitrate: 128000,       // Must be integer from allowed values
            format: "mp3",
            channel: 2             // Must be integer (1 or 2)
          },
          output_format: "url"     // Get URL instead of hex
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === 'IN_PROGRESS') {
            console.log('Generating audio...');
          }
        }
      });

      console.log('fal.ai response received');

      // Check if we got audio - fal.ai returns nested structure
      if (result && result.data && result.data.audio && result.data.audio.url) {
        return {
          audioUrl: result.data.audio.url,
          text: prompt,
          duration: result.data.duration_ms ? result.data.duration_ms / 1000 : 30,
          jobId: result.requestId || 'fal-job'
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
      'THE FOOL': 'Der Narr zeigt neue Anfänge und unbegrenztes Potenzial. Ein frischer Wind weht durch dein Leben. Du stehst am Anfang einer aufregenden Reise.',
      'THE MAGICIAN': 'Der Magier offenbart deine innere Kraft. Du besitzt alle Werkzeuge und Fähigkeiten, die du brauchst. Jetzt ist die Zeit, deine Träume zu manifestieren.',
      'THE HIGH PRIESTESS': 'Die Hohepriesterin flüstert dir zu: Vertraue deiner Intuition. Tief in dir liegt die Antwort. Die Geheimnisse des Universums öffnen sich dir.',
      'THE EMPRESS': 'Die Kaiserin segnet dich mit Fülle und Kreativität. Fruchtbarkeit in allen Lebensbereichen. Nähre deine Projekte mit Liebe.',
      'THE EMPEROR': 'Der Kaiser bringt Struktur und Autorität. Übernimm die Führung in deinem Leben. Disziplin wird dich zum Erfolg führen.',
      'THE LOVERS': 'Die Liebenden sprechen von tiefer Verbindung. Eine wichtige Entscheidung des Herzens steht bevor. Harmonie zwischen Gegensätzen.',
      'THE ICEBEAR': 'Der Eisbär symbolisiert Stärke in der Stille. In der Einsamkeit findest du deine wahre Kraft. Zeit für tiefe innere Reflexion.',
      'THE UNICORN': 'Das Einhorn bringt pure Magie in dein Leben. Reinheit und Wunder umgeben dich. Folge deinen wildesten Träumen.',
      // Add more card meanings...
    };

    let reading = `... Willkommen, suchende Seele, zu deiner mystischen Tarot-Lesung. `;
    reading += `Die Karten haben gesprochen. ${cards.length} heilige Symbole wurden für dich enthüllt. `;
    reading += `Atme tief ein... ... und aus... ... Öffne dein Herz für die Botschaften des Universums.\n\n`;

    // Three-card spread
    if (spreadType === 'three-card' && cards.length >= 3) {
      reading += `Die erste Karte liegt im Schatten deiner Vergangenheit... ... ${cards[0]}.\n`;
      reading += `${cardDescriptions[cards[0]] || 'Diese Karte birgt uralte Geheimnisse, die nur du entschlüsseln kannst.'}`;
      reading += `\n\n... ... ...\n\n`;

      reading += `Die zweite Karte pulsiert mit der Energie deiner Gegenwart... ${cards[1]}.\n`;
      reading += `${cardDescriptions[cards[1]] || 'Der gegenwärtige Moment vibriert mit unendlichen Möglichkeiten. Spürst du es?'}`;
      reading += `\n\n... ... ...\n\n`;

      reading += `Die dritte Karte... Sie enthüllt den Schleier deiner Zukunft... ${cards[2]}.\n`;
      reading += `${cardDescriptions[cards[2]] || 'Die Zukunft formt sich durch deine heutigen Entscheidungen. Das Schicksal liegt in deinen Händen.'}`;
    }

    // Celtic Cross
    else if (spreadType === 'celtic-cross' && cards.length >= 5) {
      reading += `Das keltische Kreuz wurde für dich gelegt. Eine uralte Formation der Weisheit.\n\n`;
      reading += `Im Herzen deiner Situation liegt ${cards[0]}. ... ${cardDescriptions[cards[0]] || 'Das Zentrum deines Seins.'}\n\n`;
      reading += `Gekreuzt wird sie von ${cards[1]}! ... ${cardDescriptions[cards[1]] || 'Die Herausforderung, die dich prüft.'}\n\n`;
      reading += `Über dir, wie ein Stern am Himmel, schwebt ${cards[2]}. ${cardDescriptions[cards[2]] || 'Dein bewusstes Streben.'}\n\n`;
      reading += `Tief in deinem Unterbewusstsein ruht ${cards[3]}. ${cardDescriptions[cards[3]] || 'Die verborgene Kraft in dir.'}\n\n`;
      reading += `Und die Zukunft... ... Sie zeigt ${cards[4]}. ${cardDescriptions[cards[4]] || 'Das mögliche Ergebnis deiner Reise.'}\n`;
    }

    // Single card
    else {
      reading += `Eine einzelne Karte wurde gezogen... ${cards[0]}.\n\n`;
      reading += `${cardDescriptions[cards[0]] || 'Diese eine Karte trägt die gesamte Botschaft des Universums für dich. Höre genau hin.'}`;
    }

    reading += `\n\n... ... Die Karten haben gesprochen. Möge ihre Weisheit dich auf deinem Pfad erleuchten. Vertraue dem Prozess. ... Namaste, geliebte Seele.`;

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