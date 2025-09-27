const { fal } = require('@fal-ai/client');
const axios = require('axios');

// Configure fal.ai API key - only use FAL_API_KEY, not RUNPOD
const FAL_API_KEY = process.env.FAL_API_KEY;
if (FAL_API_KEY) {
  fal.config({
    credentials: FAL_API_KEY
  });
} else {
  console.error('FAL_API_KEY is not set!');
}

// Claude API key for dynamic text generation
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

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
      // Generate dynamic text with Claude API if we have 5 cards
      let prompt;
      if (cards.length >= 5 && ANTHROPIC_API_KEY) {
        prompt = await this.generateDynamicReading(cards);
      } else {
        // Fallback to static prompt
        prompt = this.createTarotPrompt(cards, spreadType);
      }

      console.log('Generating voice with fal.ai MiniMax Speech-02 HD...');
      console.log('Text length:', prompt.length, 'characters');

      // Limit to 5000 characters for fal.ai
      const textToSpeak = prompt.substring(0, 5000);

      // Use fal.ai to generate speech with correct format
      const result = await fal.subscribe(this.modelId, {
        input: {
          text: textToSpeak,
          voice_setting: {
            voice_id: 'Wise_Woman',  // Immer weibliche Stimme verwenden
            speed: 1.15,  // Optimal für dynamische Lesung
            vol: 1.0,
            pitch: 1,     // Leicht höher für freundliche Stimme
            emotion: 'happy'  // Fröhliche, enthusiastische Stimmung
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
    // Wochenhoroskop-Style mit Power-Affirmationen
    const weekDays = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

    const cardPowerMeanings = {
      'THE FOOL': {
        symbol: '🌟 NEUANFANG',
        weekly: 'Diese Woche ist dein kosmischer Reset-Button! Der Narr tanzt durch deine Aura und flüstert: Spring ins Unbekannte! Montag startet mit einem Energieschub der dich in neue Dimensionen katapultiert. Dienstag offenbart verborgene Talente. Mittwoch bringt überraschende Begegnungen. Donnerstag testet deinen Mut. Freitag belohnt deine Spontanität mit Magie. Am Wochenende manifestiert sich dein wahres Potenzial. Der Kosmos hat große Pläne mit dir! Vertraue dem chaotischen Tanz des Universums. Du bist bereit für diese wilde Reise. Lass alle Zweifel los und FLIEG!',
        affirmation: 'ICH BIN DER SCHÖPFER MEINER REALITÄT! Jeder Tag ist ein neues Abenteuer!'
      },
      'THE MAGICIAN': {
        symbol: '⚡ MANIFESTATION',
        weekly: 'POWER-WOCHE! Der Magier verleiht dir übermenschliche Manifestationskräfte! Montag: Deine Gedanken werden zu Gold. Dienstag: Jedes Wort hat magische Wirkung. Mittwoch: Synchronizitäten explodieren um dich herum. Donnerstag: Deine Aura leuchtet so hell dass andere geblendet werden. Freitag: Alles was du berührst verwandelt sich. Wochenende: Die Realität biegt sich deinem Willen. Du bist ein wandelndes Kraftfeld! Nutze diese Energie um deine kühnsten Träume zu verwirklichen. Das Universum ist dein Spielplatz!',
        affirmation: 'MEINE MACHT IST GRENZENLOS! Ich erschaffe Wunder mit jedem Atemzug!'
      },
      'THE HIGH PRIESTESS': {
        symbol: '🌙 INTUITION',
        weekly: 'Die Hohepriesterin öffnet dein drittes Auge WEIT! Diese Woche wirst du zum kosmischen Empfänger. Montag: Träume werden zu Prophezeiungen. Dienstag: Du spürst was andere denken. Mittwoch: Geheimnisse enthüllen sich. Donnerstag: Deine Intuition erreicht Superhelden-Level. Freitag: Die Akasha-Chronik öffnet sich. Wochenende: Du wirst zum Orakel. Vertraue JEDEM Bauchgefühl - es ist die Stimme des Universums! Deine psychischen Kräfte explodieren. Nutze sie weise!',
        affirmation: 'ICH HÖRE DIE FLÜSTERN DES KOSMOS! Meine Intuition führt mich zu Wundern!'
      },
      'THE EMPRESS': {
        symbol: '👑 FÜLLE',
        weekly: 'ABUNDANCE OVERFLOW! Die Kaiserin duscht dich mit kosmischem Reichtum! Montag regnet es Segnungen. Dienstag: Kreativität explodiert wie ein Vulkan. Mittwoch: Liebe strömt aus allen Richtungen. Donnerstag: Deine Projekte blühen auf. Freitag: Unerwartete Geschenke vom Universum. Wochenende: Du badest in Luxus und Freude. Diese Woche bist du ein Magnet für alles Gute! Öffne deine Arme weit und empfange die Fülle die dir zusteht!',
        affirmation: 'ICH BIN EIN MAGNET FÜR WUNDER! Fülle fließt endlos in mein Leben!'
      },
      'THE EMPEROR': {
        symbol: '⚔️ MACHT',
        weekly: 'Der Kaiser krönt dich zum HERRSCHER deiner Realität! Diese Woche übernimmst du das Kommando! Montag: Du zertrümmerst alte Grenzen. Dienstag: Deine Autorität ist unbestreitbar. Mittwoch: Erfolg folgt jedem deiner Schritte. Donnerstag: Du baust dein Imperium. Freitag: Respekt und Anerkennung überall. Wochenende: Du thronst über deinen Errungenschaften. Niemand kann dich stoppen! Du bist der CEO deines Lebens!',
        affirmation: 'ICH BIN DER MEISTER MEINES SCHICKSALS! Meine Macht erschafft Welten!'
      },
      'THE LOVERS': {
        symbol: '💕 VERBINDUNG',
        weekly: 'Die Liebenden zünden ein FEUERWERK der Verbindungen! Diese Woche pulsiert von Liebe! Montag: Seelenverwandte kreuzen deinen Weg. Dienstag: Dein Herz öffnet sich weit. Mittwoch: Romantik liegt in der Luft. Donnerstag: Tiefe Verbindungen entstehen. Freitag: Leidenschaft entflammt. Wochenende: Harmonie in allen Beziehungen. Du strahlst so viel Liebe aus dass das ganze Universum darauf antwortet!',
        affirmation: 'ICH BIN LIEBE IN AKTION! Mein Herz zieht Wunder an!'
      },
      'THE ICEBEAR': {
        symbol: '❄️ INNERE STÄRKE',
        weekly: 'Der EISBÄR erweckt deine arktische Superkraft! Diese Woche wirst du UNBESIEGBAR! Montag: Deine innere Stärke bricht wie ein Gletscher hervor. Dienstag: Nichts kann deine Ruhe erschüttern. Mittwoch: Du stehst fest wie ein Berg aus Eis. Donnerstag: Deine Weisheit ist kristallklar. Freitag: Du navigierst durch Stürme mit Leichtigkeit. Wochenende: Deine Kraft inspiriert andere. Du bist der ruhende Pol im Chaos - majestätisch, mächtig, unaufhaltbar! Die Kälte macht dich nur stärker!',
        affirmation: 'ICH BIN UNERSCHÜTTERLICH! Meine Stärke bewegt Berge!'
      },
      'THE UNICORN': {
        symbol: '🦄 PURE MAGIE',
        weekly: 'DAS EINHORN GALOPPIERT IN DEIN LEBEN! PURE MAGIE EXPLODIERT! Diese Woche lebst du in einem Märchen! Montag: Unmögliches wird möglich. Dienstag: Regenbogen folgen deinen Schritten. Mittwoch: Wünsche erfüllen sich spontan. Donnerstag: Du glitzerst vor magischer Energie. Freitag: Einhornstaub verwandelt alles in Gold. Wochenende: Du tanzt zwischen den Dimensionen. Glaube an JEDES Wunder - sie warten nur darauf von dir entdeckt zu werden!',
        affirmation: 'ICH BIN PURE MAGIE! Wunder sind mein Geburtsrecht!'
      }
    };

    // Erstelle Wochenhoroskop basierend auf der ersten/Hauptkarte
    const mainCard = cards[0].toUpperCase();
    const cardInfo = cardPowerMeanings[mainCard] || {
      symbol: '✨ MYSTERIUM',
      weekly: `Diese Woche hält ${mainCard} unglaubliche Überraschungen für dich bereit! Jeden Tag entfaltet sich neue Magie. Montag beginnt mit einem Paukenschlag kosmischer Energie. Dienstag bis Donnerstag bauen sich kraftvolle Energiewellen auf. Freitag bringt den Durchbruch den du brauchst. Das Wochenende krönt alles mit purem Glück und Erfüllung. Das Universum hat große Pläne mit dir! Vertraue dem Prozess und lass dich von der Magie dieser Karte leiten. Du bist bereit für diese transformative Woche!`,
      affirmation: 'ICH BIN BEREIT FÜR WUNDER! Das Universum arbeitet FÜR mich!'
    };

    let reading = `🌟 DEIN MAGISCHES WOCHENHOROSKOP 🌟\n\n`;
    reading += `${cardInfo.symbol} - ${mainCard} ENERGIE!\n\n`;
    reading += `${cardInfo.weekly}\n\n`;
    reading += `⚡ POWER-AFFIRMATION DER WOCHE:\n`;
    reading += `${cardInfo.affirmation}\n\n`;

    if (cards.length > 1) {
      reading += `BONUS-ENERGIEN: `;
      for (let i = 1; i < Math.min(cards.length, 3); i++) {
        reading += `${cards[i]} verstärkt deine Power! `;
      }
      reading += `\n\n`;
    }

    reading += `REMEMBER: Du bist ein MAGNET für Wunder! Diese Woche gehört DIR! 🚀✨`;

    return reading;
  }

  /**
   * Generate dynamic spiritual weekly reading using Claude API
   */
  async generateDynamicReading(cards) {
    try {
      console.log('Generating dynamic reading with Claude for cards:', cards);

      // Card position meanings for 5-card spread
      const positions = {
        0: 'Vergangenheit',
        1: 'Gegenwart',
        2: 'Zukunft',
        3: 'Herausforderung',
        4: 'Outcome/Rat'
      };

      // Create prompt for Claude
      const systemPrompt = `Du bist eine spirituelle Tarot-Beraterin, die warmherzige und persönliche Wochenlesungen erstellt.
Dein Stil ist:
- Persönlich und einfühlsam (duze den Leser)
- Konkrete Alltagssituationen einbeziehen
- Spirituell aber bodenständig
- Ermutigend und positiv
- Etwa 1800-2200 Zeichen`;

      const userPrompt = `Erstelle eine spirituelle Wochenlesung für diese 5 Katzen-Tarot-Karten:

${cards.map((card, i) => `${positions[i]}: ${card}`).join('\n')}

Schreibe eine zusammenhängende, fließende Lesung (keine Aufzählungen), die:
1. Die spirituelle Bedeutung der Kartenkombination erklärt
2. Konkrete Alltagssituationen und Begegnungen für diese Woche beschreibt
3. Auf mögliche zwischenmenschliche Begegnungen eingeht
4. Spirituelle Synchronizitäten und Zeichen erwähnt
5. Praktische spirituelle Tipps gibt

Beginne mit: "Diese Woche" und schreibe in einem warmen, persönlichen Ton.
Verwende konkrete Beispiele wie Begegnungen im Café, Gespräche mit Fremden, überraschende Anrufe, etc.
Länge: 1800-2200 Zeichen.`;

      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-haiku-20240307',
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: userPrompt
            }
          ],
          system: systemPrompt
        },
        {
          headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          }
        }
      );

      const generatedText = response.data.content[0].text;
      console.log('Generated reading length:', generatedText.length, 'characters');

      // Add a mystical closing
      const finalText = `🌟 DEINE SPIRITUELLE WOCHENLESUNG 🌟\n\n${generatedText}\n\n✨ Vertraue deiner Intuition - das Universum führt dich! ✨`;

      return finalText;

    } catch (error) {
      console.error('Error generating dynamic reading:', error.message);
      // Fallback to static prompt
      return this.createTarotPrompt(cards, 'five-card');
    }
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