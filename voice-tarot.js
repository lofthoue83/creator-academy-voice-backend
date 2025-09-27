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
   * Create mystical tarot reading prompt with personalization
   */
  createTarotPrompt(cards, spreadType, userName = 'Lena', friends = ['Max', 'Sophie', 'Julian', 'Emma']) {
    // Wochenhoroskop-Style mit Power-Affirmationen
    const weekDays = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

    const cardPowerMeanings = {
      'THE FOOL': {
        symbol: '🌟 NEUANFANG',
        weekly: `Liebe ${userName}! Diese Woche ist DEIN kosmischer Reset-Button! Der Narr tanzt durch deine Aura! Am Montag wird ${friends[0]} dich mit einer verrückten Idee überraschen - sag JA! Dienstag offenbart ${friends[1]} dir ein Geheimnis das alles verändert. Mittwoch bringt eine Nachricht von ${friends[2]} die dein Herz höher schlagen lässt. Donnerstag testet ${friends[3]} deinen Mut mit einer Challenge. Freitag feierst du mit allen vieren einen magischen Durchbruch. ${userName}, der Kosmos hat große Pläne für dich und deine Crew! Vertraue dem chaotischen Tanz. Diese Woche gehört DIR!`,
        affirmation: `${userName.toUpperCase()}, DU BIST DIE SCHÖPFERIN DEINER REALITÄT! Deine Freunde sind deine magischen Helfer!`
      },
      'THE MAGICIAN': {
        symbol: '⚡ MANIFESTATION',
        weekly: `${userName}, POWER-WOCHE! Der Magier und ${friends[0]} verleihen dir Manifestationskräfte! Montag: ${friends[1]} bringt dir eine goldene Gelegenheit. Dienstag: Deine Worte zu ${friends[2]} werden Realität. Mittwoch: ${friends[3]} erlebt mit dir unglaubliche Synchronizitäten. Donnerstag: ${friends[0]} ist geblendet von deiner Aura! Freitag verwandelst du mit ${friends[1]} alles in Gold. Am Wochenende feiern alle vier Freunde deinen Erfolg! ${userName}, du bist ein wandelndes Kraftfeld! Das Universum arbeitet FÜR dich!`,
        affirmation: `${userName.toUpperCase()}, DEINE MACHT IST GRENZENLOS! ${friends[0]} und ${friends[1]} sind deine Kraft-Multiplikatoren!`
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
        weekly: `${userName}! Der EISBÄR und ${friends[2]} erwecken deine arktische Superkraft! Am Montag zeigt dir ${friends[0]} wie stark du wirklich bist. Dienstag: ${friends[1]} bewundert deine unerschütterliche Ruhe. Mittwoch steht ${friends[3]} wie ein Fels an deiner Seite. Donnerstag teilt ${friends[2]} kristallklare Weisheit mit dir. Freitag navigierst du mit allen vieren durch einen Sturm - und gewinnst! ${userName}, du bist der ruhende Pol für deine Freunde! Majestätisch und mächtig!`,
        affirmation: `${userName.toUpperCase()} IST UNERSCHÜTTERLICH! Mit ${friends[2]} als Energieverstärker bewegst du Berge!`
      },
      'THE UNICORN': {
        symbol: '🦄 PURE MAGIE',
        weekly: `${userName}! DAS EINHORN GALOPPIERT ZU DIR UND ${friends[3]}! Diese Woche ist DEIN Märchen! Montag macht ${friends[0]} das Unmögliche möglich für dich. Dienstag folgt ${friends[1]} deinen Regenbogen-Spuren. Mittwoch erfüllt ${friends[2]} einen geheimen Wunsch. Donnerstag glitzerst du mit ${friends[3]} vor Magie! Freitag verwandelt ihr zu fünft alles in Gold. ${userName}, du und deine magische Crew tanzt zwischen den Welten! GLAUBE an eure Wunderkraft!`,
        affirmation: `${userName.toUpperCase()} IST PURE MAGIE! ${friends[3]} ist dein Glücksbote aus dem Einhorn-Reich!`
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

      // Get current date for weekly reference
      const today = new Date();
      const weekDays = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
      const currentDay = weekDays[today.getDay()];
      const currentMonth = today.toLocaleDateString('de-DE', { month: 'long' });

      // Assign magical roles to friends
      const friendRoles = {
        [friends[0]]: 'dein kosmischer Wegweiser',
        [friends[1]]: 'deine spirituelle Spiegelseele',
        [friends[2]]: 'dein Energieverstärker',
        [friends[3]]: 'dein Glücksbote'
      };

      // Create prompt for Claude
      const systemPrompt = `Du bist eine spirituelle Tarot-Beraterin, die SEHR persönliche Wochenlesungen für ${userName} erstellt.
WICHTIG:
- Sprich ${userName} DIREKT mit Namen an (mindestens 3-4 mal in der Lesung)
- Erwähne ihre Freunde ${friends.join(', ')} mit ihren magischen Rollen
- Beziehe dich auf DIESE KONKRETE Woche im ${currentMonth} (heute ist ${currentDay})
- Nenne konkrete Wochentage für Ereignisse
- Sei sehr persönlich und detailliert
- Etwa 2000-2500 Zeichen`;

      const userPrompt = `Erstelle eine SEHR persönliche Wochenlesung für ${userName} mit diesen 5 Katzen-Tarot-Karten:

${cards.map((card, i) => `${positions[i]}: ${card}`).join('\n')}

${userName}s magische Begleiter diese Woche:
${Object.entries(friendRoles).map(([friend, role]) => `- ${friend} als ${role}`).join('\n')}

Schreibe eine fließende, persönliche Lesung die:
1. ${userName} direkt anspricht (verwende den Namen oft!)
2. Konkrete Tage dieser Woche nennt (z.B. "Am Mittwoch wird ${friends[0]} als dein kosmischer Wegweiser...")
3. Die Freunde in magischen Rollen einbaut (z.B. "${friends[1]} wird als deine Spiegelseele am Donnerstag...")
4. Sich auf DIESE spezifische Woche bezieht (nicht allgemein)
5. Konkrete Orte und Situationen nennt (Lieblingscafé, Arbeit, Supermarkt, WhatsApp-Nachricht)
6. Überraschende Wendungen mit den Freunden beschreibt

Beginne mit: "Liebe ${userName}, diese Woche im ${currentMonth}" und baue die Freunde natürlich in die Geschichte ein.
Die Freunde sollen als magische Helfer auftreten, die ${userName} durch die Woche begleiten.
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