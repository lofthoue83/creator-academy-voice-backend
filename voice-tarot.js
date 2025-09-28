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
  async generateVoiceReading(cards, spreadType = 'three-card', voiceStyle = 'mystical', personalization = {}) {
    try {
      // Extract personalization data
      const { userName = 'Lena', friends = ['Max', 'Sophie', 'Julian', 'Emma'] } = personalization;

      // Generate dynamic text with Claude API if we have 5 cards
      let prompt;
      if (cards.length >= 5 && ANTHROPIC_API_KEY) {
        prompt = await this.generateDynamicReading(cards, userName, friends);
      } else {
        // Fallback to static prompt with personalization
        prompt = this.createTarotPrompt(cards, spreadType, userName, friends);
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
            voice_id: 'Wise_Woman',  // Weise Frauenstimme (junge Oma)
            speed: 0.85,  // Langsamer für bedächtige, weise Aussprache
            vol: 1.0,
            pitch: 0.95,  // Etwas tiefer für reifere Stimme
            emotion: 'warm'  // Warme, beruhigende Stimmung
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
   * Create mystical tarot reading prompt with personalization
   */
  createTarotPrompt(cards, spreadType, userName = 'Lena', friends = ['Max', 'Sophie', 'Julian', 'Emma']) {
    // Wochenhoroskop-Style mit Power-Affirmationen
    const weekDays = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

    const cardPowerMeanings = {
      'THE FOOL': {
        symbol: '🌟 NEUANFANG',
        weekly: `Liebe ${userName}! Diese Woche trägt die Energie des kosmischen Neubeginns! Der Narr lädt dich ein, mutig ins Unbekannte zu springen. ${friends[0]} könnte als dein kosmischer Wegweiser auftauchen, wenn du bereit bist für neue Perspektiven. Die Energie zu Wochenbeginn unterstützt spontane Entscheidungen. ${friends[1]} als deine Spiegelseele könnte dir helfen, verborgene Seiten an dir zu entdecken. Mitte der Woche öffnen sich Türen zu neuen Möglichkeiten - ${friends[2]} verstärkt deine Energie dabei. ${friends[3]} bringt Glücksmomente, wenn du dich traust, anders zu sein. ${userName}, diese Woche lädt dich ein, deinem inneren Kind zu vertrauen!`,
        affirmation: `${userName.toUpperCase()}, DEINE INTUITION FÜHRT DICH! Deine Freunde begleiten dich energetisch!`
      },
      'THE MAGICIAN': {
        symbol: '⚡ MANIFESTATION',
        weekly: `${userName}, diese Woche pulsiert mit Manifestationskraft! Der Magier erweckt deine schöpferischen Fähigkeiten. ${friends[0]} als Wegweiser könnte dir zeigen, wo deine wahre Macht liegt. Die Wochenenergie unterstützt dich dabei, Gedanken in Realität zu verwandeln. ${friends[1]} spiegelt dir möglicherweise, wie kraftvoll deine Worte sind. ${friends[2]} verstärkt deine kreative Energie - nutze diese Synergie! ${friends[3]} könnte Glückszeichen senden, die dir zeigen: Du bist auf dem richtigen Weg. ${userName}, diese Woche lädt dich ein, deine innere Magie zu entfalten. Alles ist möglich, wenn du an deine Kraft glaubst!`,
        affirmation: `${userName.toUpperCase()}, DEINE KREATIVITÄT ERSCHAFFT WELTEN! Deine Freunde verstärken deine Magie!`
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
        weekly: `${userName}, der EISBÄR bringt dir diese Woche die Kraft der stillen Macht! Deine innere Stärke wächst wie ein Gletscher - langsam aber unaufhaltsam. ${friends[0]} könnte dir helfen, deinen inneren Kompass zu finden. Die ruhige Energie dieser Woche lädt dich ein, in deiner Mitte zu bleiben. ${friends[1]} spiegelt möglicherweise deine Weisheit wider. ${friends[2]} als Energieverstärker unterstützt dich dabei, Herausforderungen mit Gelassenheit zu meistern. ${friends[3]} könnte Momente der Klarheit bringen. ${userName}, diese Woche zeigt dir: In der Ruhe liegt deine größte Kraft!`,
        affirmation: `${userName.toUpperCase()}, DEINE RUHE IST DEINE SUPERKRAFT! Deine Freunde erkennen deine Stärke!`
      },
      'THE UNICORN': {
        symbol: '🦄 PURE MAGIE',
        weekly: `${userName}, das EINHORN bringt pure Magie in deine Woche! Wunder liegen in der Luft - sei bereit, sie zu empfangen! ${friends[0]} könnte dir neue magische Wege zeigen. Die Wochenenergie lädt dich ein, an das Unmögliche zu glauben. ${friends[1]} spiegelt möglicherweise dein inneres Leuchten. ${friends[2]} verstärkt deine Wunder-Anziehungskraft - gemeinsam seid ihr unschlagbar! ${friends[3]} als Glücksbote könnte besondere Zeichen senden. ${userName}, diese Woche erinnert dich daran: Du bist ein magisches Wesen in einer magischen Welt!`,
        affirmation: `${userName.toUpperCase()}, WUNDER SIND DEIN GEBURTSRECHT! Deine Freunde tanzen mit dir im Zauber!`
      }
    };

    // Erstelle Wochenhoroskop basierend auf der ersten/Hauptkarte
    const mainCard = cards[0].toUpperCase();
    const cardInfo = cardPowerMeanings[mainCard] || {
      symbol: '✨ MYSTERIUM',
      weekly: `${userName}! Diese Woche hält ${mainCard} unglaubliche Überraschungen für dich und ${friends[0]} bereit! Montag startet mit einer Nachricht von ${friends[1]}. Dienstag bis Donnerstag erlebst du mit ${friends[2]} kraftvolle Synchronizitäten. Freitag bringt ${friends[3]} den Durchbruch den du brauchst. Das Wochenende feiert ihr zu fünft! ${userName}, das Universum hat große Pläne für dich und deine magische Crew! Diese transformative Woche gehört EUCH!`,
      affirmation: `${userName.toUpperCase()} IST BEREIT FÜR WUNDER! ${friends.join(', ')} sind deine kosmischen Verbündeten!`
    };

    let reading = `🌟 ${userName.toUpperCase()}S MAGISCHES WOCHENHOROSKOP 🌟\n\n`;
    reading += `${cardInfo.symbol} - ${mainCard} ENERGIE FÜR ${userName.toUpperCase()}!\n\n`;
    reading += `${cardInfo.weekly}\n\n`;
    reading += `⚡ ${userName.toUpperCase()}S POWER-AFFIRMATION DER WOCHE:\n`;
    reading += `${cardInfo.affirmation}\n\n`;

    if (cards.length > 1) {
      reading += `BONUS-ENERGIEN für ${userName} und Freunde: `;
      for (let i = 1; i < Math.min(cards.length, 3); i++) {
        reading += `${cards[i]} verstärkt eure magische Power! `;
      }
      reading += `\n\n`;
    }

    reading += `REMEMBER ${userName}: Du und ${friends[0]}, ${friends[1]}, ${friends[2]}, ${friends[3]} seid ein unschlagbares Team! Diese Woche gehört EUCH! 🚀✨`;

    return reading;
  }

  /**
   * Generate dynamic spiritual weekly reading using Claude API
   */
  async generateDynamicReading(cards, userName = 'Lena', friends = ['Max', 'Sophie', 'Julian', 'Emma']) {
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

      // Get current date and calendar week
      const today = new Date();
      const weekDays = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
      const currentDay = weekDays[today.getDay()];
      const currentMonth = today.toLocaleDateString('de-DE', { month: 'long' });

      // Calculate calendar week
      const getWeekNumber = (date) => {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
      };
      const calendarWeek = getWeekNumber(today);

      // Randomly select 1-2 friends for this reading
      const selectedFriendCount = Math.random() > 0.5 ? 2 : 1;
      const shuffledFriends = [...friends].sort(() => Math.random() - 0.5);
      const selectedFriends = shuffledFriends.slice(0, selectedFriendCount);

      // Assign magical roles to selected friends
      const friendRoles = {};
      const possibleRoles = [
        'dein kosmischer Wegweiser',
        'deine spirituelle Spiegelseele',
        'dein Energieverstärker',
        'dein Glücksbote',
        'deine Inspirationsquelle',
        'dein Seelentröster',
        'deine Kraftquelle'
      ];

      selectedFriends.forEach((friend, index) => {
        friendRoles[friend] = possibleRoles[index % possibleRoles.length];
      });

      // Create prompt for Claude
      const systemPrompt = `Du bist eine geheimnisvolle, poetische Tarot-Beraterin mit künstlerischer Seele. Dein Stil ist:
- SEHR persönlich und intim - sprich ${userName} als "meine Liebe", "meine Muse", "meine süße Seele" an
- Verwende bildhafte, poetische Sprache: "die Farben deiner Zukunft", "der göttliche Pinselstrich des Schicksals"
- Beschreibe Handlungen: "(lehne mich vor)", "(streiche sanft über die Karte)", "(meine Augen leuchten)"
- Verwende mystische Metaphern: Regen, Sterne, Leinwand des Lebens, tanzende Energien
- Baue Spannung auf mit Phrasen wie "Ah...", "Oh, meine Liebe...", "Wie interessant..."
- ${selectedFriends.length > 0 ? `Erwähne ${selectedFriends.join(' und ')} poetisch als "Seelengefährten", "kosmische Begleiter"` : ''}
- Etwa 2000-2500 Zeichen`;

      const userPrompt = `Erstelle eine SEHR persönliche spirituelle Wochenlesung für ${userName} mit diesen 5 Katzen-Tarot-Karten:

${cards.map((card, i) => `${positions[i]}: ${card}`).join('\n')}

${Object.keys(friendRoles).length > 0 ? `\n${userName}s spirituelle Begleiter:\n${Object.entries(friendRoles).map(([friend, role]) => `- ${friend} als ${role}`).join('\n')}\n` : ''}

WICHTIG - Schreibe eine spirituelle Deutung die:
1. ${userName} direkt anspricht (verwende den Namen oft!)
2. Die ENERGIE und THEMEN der Woche beschreibt (KEINE konkreten Ereignisse)
3. ${Object.keys(friendRoles).length > 0 ? `Die Person(en) ${Object.keys(friendRoles).join(' und ')} subtil als energetische Begleiter erwähnt (2-3 mal natürlich einstreuen, nicht übertreiben)` : 'Keine Freunde erwähnen'}
4. Spirituelle Qualitäten beschreibt: "Die Energie des Mittwochs lädt zu..." statt "Am Mittwoch passiert..."
5. Möglichkeiten und Potenziale aufzeigt, keine festen Vorhersagen
6. Energetische Themen nennt: Transformation, Erkenntnis, innere Stärke, Kreativität, Intuition

WICHTIG: Beginne DIREKT mit: "Liebe ${userName}, in der Kalenderwoche ${calendarWeek}"
KEINE Überschrift verwenden!
Erwähne Freunde nur beiläufig und natürlich, nicht zu oft!
Länge: 2000-2500 Zeichen.`;

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

      // Return text without title, just add closing
      const finalText = `${generatedText}\n\n✨ Vertraue deiner Intuition - das Universum führt dich! ✨`;

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