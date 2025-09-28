const axios = require('axios');

// WaveSpeed API key for TTS
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;
if (!WAVESPEED_API_KEY) {
  console.error('WAVESPEED_API_KEY is not set!');
}

// Claude API key for dynamic text generation
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

class VoiceTarotService {
  constructor() {
    this.wavespeedEndpoint = 'https://api.wavespeed.ai/api/v3/minimax/speech-02-hd';
  }

  /**
   * Generate individual card reading for card-by-card playback
   */
  generateCardReading(card, position, userName = 'Lena') {
    const cardReadings = {
      // Positions for 5-card spread
      0: `Deine Vergangenheit, ${userName}...`,
      1: `In deiner Gegenwart zeigt sich...`,
      2: `Die Zukunft offenbart...`,
      3: `Deine Herausforderung ist...`,
      4: `Der kosmische Rat lautet...`
    };

    const prefix = cardReadings[position] || `Karte ${position + 1} zeigt...`;

    // Create personalized short reading for this specific card (max 800 chars)
    const cardMeanings = {
      'THE FOOL': `${prefix} Der Narr tanzt in dein Leben! Eine frische Energie durchströmt dich. Du stehst am Anfang eines magischen Weges. Vertraue deiner Intuition und wage den Sprung ins Unbekannte. Das Universum fängt dich auf, ${userName}. Diese Karte ermutigt dich, mit kindlicher Neugier und offenem Herzen voranzuschreiten. Alte Muster dürfen losgelassen werden. Die Zeit ist reif für Spontanität und Abenteuer!`,

      'THE MAGICIAN': `${prefix} Der Magier erweckt deine schöpferische Kraft! Du besitzt alle Werkzeuge, die du brauchst, ${userName}. Deine Gedanken werden zu Realität. Nutze deine Manifestationskraft weise. Diese Woche öffnen sich Türen, von denen du nur geträumt hast. Konzentriere dich auf deine Ziele und handle mit Klarheit. Die Elemente tanzen nach deinem Willen!`,

      'THE HIGH PRIESTESS': `${prefix} Die Hohepriesterin flüstert Geheimnisse! Deine Intuition ist jetzt dein mächtigster Verbündeter, ${userName}. Achte auf Träume und Synchronizitäten. Verborgenes Wissen offenbart sich dir. Meditation und Stille bringen tiefe Einsichten. Vertraue deinem inneren Wissen mehr als äußeren Ratschlägen. Die Schleier zwischen den Welten sind dünn!`,

      'THE EMPRESS': `${prefix} Die Kaiserin segnet dich mit Fülle! Kreativität und Wachstum blühen in deinem Leben auf, ${userName}. Nähre deine Projekte mit Liebe. Sinnlichkeit und Schönheit umgeben dich. Diese Phase bringt Fruchtbarkeit in allen Lebensbereichen. Genieße die Geschenke des Lebens und teile deinen Überfluss. Du bist ein Kanal für kosmische Abundance!`,

      'THE EMPEROR': `${prefix} Der Kaiser verleiht dir Autorität! Übernimm die Führung in deinem Leben, ${userName}. Struktur und Disziplin sind deine Superkräfte. Setze klare Grenzen und verfolge deine Ziele mit Entschlossenheit. Diese Energie unterstützt langfristige Pläne und Stabilität. Du bist der Architekt deiner Realität. Herrsche weise über dein Reich!`,

      'THE ICEBEAR': `${prefix} Der Eisbär bringt stille Stärke! In der Ruhe liegt deine größte Macht, ${userName}. Wie der mächtige Eisbär navigierst du durch emotionale Gewässer mit Anmut. Diese Karte lehrt Geduld und Weisheit. Deine innere Wärme schmilzt alle Hindernisse. Vertraue deiner natürlichen Kraft und bewege dich mit bedachter Eleganz!`,

      'THE UNICORN': `${prefix} Das Einhorn bringt pure Magie! Wunder manifestieren sich in deinem Leben, ${userName}. Das Unmögliche wird möglich. Deine Einzigartigkeit ist deine Superkraft. Diese mystische Energie öffnet Portale zu neuen Dimensionen. Glaube an Magie, denn du BIST die Magie! Regenbogenenergie durchströmt dein ganzes Sein!`
    };

    // Default reading for cards not explicitly defined
    const defaultReading = `${prefix} ${card} bringt transformative Energie in dein Leben, ${userName}! Diese Karte öffnet neue Wege und Möglichkeiten. Achte auf die Zeichen des Universums. Deine Intuition führt dich zu wichtigen Erkenntnissen. Die kosmischen Kräfte arbeiten zu deinen Gunsten. Vertraue dem Prozess und lass dich von der Magie dieser Karte leiten!`;

    return cardMeanings[card.toUpperCase()] || defaultReading;
  }

  /**
   * Generate audio for a single text segment
   */
  async generateSegmentAudio(text, segmentIndex) {
    try {
      console.log(`Generating audio for segment ${segmentIndex + 1}, length: ${text.length} chars`);

      // Rotate emotions for variety: surprised, happy, neutral pattern
      const emotions = ["surprised", "happy", "neutral"];
      const emotion = emotions[segmentIndex % emotions.length];
      console.log(`Using emotion: ${emotion} for segment ${segmentIndex + 1}`);

      const wavespeedResponse = await axios.post(
        this.wavespeedEndpoint,
        {
          text: text,
          voice_id: "Tilda-001",  // Custom cloned grandmother voice
          speed: 1.0,  // Normal speed
          volume: 0.95,
          pitch: 0,  // Natural pitch
          emotion: emotion,  // Dynamic emotion changes
          // Remove reverb/echo effects
          audio_setting: {
            reverb_level: 0,  // No reverb/hall effect
            noise_reduction: true
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      let result = wavespeedResponse.data;

      // If response has data wrapper, extract it
      if (result.data) {
        result = result.data;
      }

      // Poll for result if status is "created" or "processing"
      if (result.id && result.urls && result.urls.get) {
        console.log(`Polling for segment ${segmentIndex + 1} result...`);
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds max wait

        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

          const pollResponse = await axios.get(
            result.urls.get,
            {
              headers: {
                'Authorization': `Bearer ${WAVESPEED_API_KEY}`
              }
            }
          );

          const pollResult = pollResponse.data.data || pollResponse.data;

          if (pollResult.status === 'completed' && pollResult.outputs && pollResult.outputs.length > 0) {
            return {
              audioUrl: pollResult.outputs[0],
              text: text,
              jobId: result.id
            };
          } else if (pollResult.status === 'failed' || pollResult.status === 'error') {
            console.error(`Segment ${segmentIndex + 1} generation failed:`, pollResult.error);
            return null;
          }

          attempts++;
        }
      }

      // Direct response check (if not async)
      if (result && result.outputs && result.outputs.length > 0) {
        return {
          audioUrl: result.outputs[0],
          text: text,
          jobId: result.id || 'wavespeed-job'
        };
      }

      return null;
    } catch (error) {
      console.error(`Error generating segment ${segmentIndex + 1}:`, error.message);
      return null;
    }
  }

  /**
   * Generate voice tarot reading from detected cards (card-by-card)
   * @param {Array} cards - Array of detected card names
   * @param {String} spreadType - Type of tarot spread (cross, three-card, etc)
   * @param {String} voiceStyle - Voice style (mystical, calm, energetic)
   * @returns {Object} Audio segments per card
   */
  async generateVoiceReading(cards, spreadType = 'three-card', voiceStyle = 'mystical', personalization = {}) {
    try {
      // Extract personalization data
      const { userName = 'Lena', friends = ['Max', 'Sophie', 'Julian', 'Emma'] } = personalization;

      console.log('Generating card-by-card readings for:', cards);

      // First generate the full reading text from Claude
      let fullReadingText = '';
      if (ANTHROPIC_API_KEY) {
        console.log('Using Claude to generate dynamic reading...');
        fullReadingText = await this.generateDynamicReading(cards, userName, friends);
      } else {
        console.log('No Claude API key, using fallback reading...');
        fullReadingText = this.createTarotPrompt(cards, spreadType, userName, friends);
      }

      // Split the text by position markers (must match Claude's output exactly)
      const positionMarkers = [
        'KARTE DER VERGANGENHEIT:',
        'KARTE DER GEGENWART:',
        'KARTE DER ZUKUNFT:',
        'KARTE DER HERAUSFORDERUNG:',
        'KARTE DES ERGEBNISSES:'
      ];

      let textSegments = [fullReadingText];

      // Split by each position marker
      for (const marker of positionMarkers) {
        let newSegments = [];
        for (const segment of textSegments) {
          const parts = segment.split(marker);
          if (parts.length > 1) {
            newSegments.push(parts[0]);
            for (let i = 1; i < parts.length; i++) {
              newSegments.push(marker + parts[i]);
            }
          } else {
            newSegments.push(segment);
          }
        }
        textSegments = newSegments;
      }

      // Remove empty segments and trim
      textSegments = textSegments.filter(s => s.trim()).map(s => s.trim());
      console.log(`Split text into ${textSegments.length} segments by position markers`);

      // Create card segments from split text
      const cardSegments = [];
      for (let i = 0; i < Math.min(cards.length, textSegments.length); i++) {
        const segmentText = textSegments[i].trim();
        console.log(`Segment ${i + 1} text length: ${segmentText.length} chars`);

        cardSegments.push({
          index: i,
          card: cards[i],
          text: segmentText,
          audioUrl: null,
          generated: false
        });
      }

      // If we have fewer segments than cards (fallback or error), use generated text
      if (cardSegments.length < cards.length) {
        console.log('Not enough segments from Claude, filling with generated readings...');
        for (let i = cardSegments.length; i < cards.length; i++) {
          const cardText = this.generateCardReading(cards[i], i, userName);
          cardSegments.push({
            index: i,
            card: cards[i],
            text: cardText,
            audioUrl: null,
            generated: false
          });
        }
      }

      // Generate audio for ALL cards upfront to avoid lazy loading issues
      console.log('Generating audio for all 5 cards upfront...');

      // Generate all audio segments in parallel for faster processing
      const audioPromises = cardSegments.map((segment, index) => {
        return this.generateSegmentAudio(segment.text, index)
          .then(audio => {
            if (audio) {
              cardSegments[index].audioUrl = audio.audioUrl;
              cardSegments[index].generated = true;
              console.log(`Audio generated for card ${index + 1}: ${segment.card}`);
            }
            return audio;
          })
          .catch(error => {
            console.error(`Failed to generate audio for card ${index + 1}:`, error);
            return null;
          });
      });

      // Wait for all audio generation to complete
      const audioResults = await Promise.all(audioPromises);
      console.log(`Successfully generated ${audioResults.filter(a => a).length} of ${cardSegments.length} audio segments`);

      // Create full text for logging
      const fullText = cardSegments.map(s => s.text).join('\n\n');
      console.log('Total cards:', cardSegments.length);
      console.log('First card text length:', cardSegments[0]?.text.length);

      return {
        // Keep backward compatibility
        audioUrl: cardSegments[0]?.audioUrl,
        text: fullText,

        // Card-by-card structure
        segments: cardSegments,
        totalSegments: cardSegments.length,
        currentSegment: 0,

        // Metadata
        duration: 30,
        jobId: 'card-by-card-reading',

        // Debug info for Xcode console
        debug: {
          claudeRequest: `Cards: ${cards.join(', ')}`,
          claudeResponse: fullText,
          systemPrompt: 'Mystical tarot reading system'
        }
      };

    } catch (error) {
      console.error('WaveSpeed TTS error:');
      console.error('Error message:', error.message);

      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }

      // Return text-only version on error
      return {
        audioUrl: null,
        text: 'Audio generation failed',
        segments: [{
          index: 0,
          card: cards[0] || 'UNKNOWN',
          text: 'Audio konnte nicht generiert werden.',
          audioUrl: null,
          generated: false
        }],
        duration: 30,
        jobId: 'error',
        message: 'Audio konnte nicht generiert werden.',
        debugError: error.message,
        success: true
      };
    }
  }

  /**
   * Generate audio for next segment
   */
  async generateNextSegment(segmentIndex, text) {
    try {
      const audio = await this.generateSegmentAudio(text, segmentIndex);
      return {
        success: true,
        audioUrl: audio?.audioUrl,
        jobId: audio?.jobId
      };
    } catch (error) {
      console.error('Error generating next segment:', error);
      return {
        success: false,
        error: error.message
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

      // Create prompt for Claude with POSITION-BASED markers
      const systemPrompt = `Du bist eine geheimnisvolle, poetische Tarot-Beraterin mit künstlerischer Seele.

🚫 ABSOLUTE VERBOTE:
- NIEMALS "Katzen-Tarot" oder "Katzen" erwähnen!
- KEINE erfundenen Kartennamen wie "TURM", "SCHER-PAGES" etc.
- Verwende NUR die EXAKTEN englischen Kartennamen die dir gegeben werden!

ABSOLUT KRITISCH - STRUKTUR:
Du MUSST deine Lesung in EXAKT 5 Abschnitte unterteilen.
JEDER Abschnitt MUSS mit EXAKT diesen Phrasen beginnen:

1. "KARTE DER VERGANGENHEIT: [exakter Kartenname]"
2. "KARTE DER GEGENWART: [exakter Kartenname]"
3. "KARTE DER ZUKUNFT: [exakter Kartenname]"
4. "KARTE DER HERAUSFORDERUNG: [exakter Kartenname]"
5. "KARTE DES ERGEBNISSES: [exakter Kartenname]"

KEINE anderen Formulierungen! EXAKT diese Marker verwenden!

Dein Stil:
- SEHR persönlich und intim - sprich ${userName} als "meine Liebe", "meine Muse" an
- Verwende bildhafte, poetische Sprache
- Beschreibe Handlungen: "(lehne mich vor)", "(streiche sanft über die Karte)"
- ${selectedFriends.length > 0 ? `Erwähne ${selectedFriends.join(' und ')} poetisch als "Seelengefährten"` : ''}
- Etwa 400-500 Zeichen PRO Position`;

      const userPrompt = `Erstelle eine SEHR persönliche spirituelle Wochenlesung für ${userName} mit diesen 5 Tarot-Karten:

${cards.map((card, i) => `${positions[i]}: ${card}`).join('\n')}

${Object.keys(friendRoles).length > 0 ? `\n${userName}s spirituelle Begleiter:\n${Object.entries(friendRoles).map(([friend, role]) => `- ${friend} als ${role}`).join('\n')}\n` : ''}

ABSOLUT KRITISCH - STRUKTUR UND POSITIONEN:

Du MUSST diese EXAKTE Struktur verwenden:

1. Beginne mit: "KARTE DER VERGANGENHEIT: ${cards[0]} [dann dein Text]"
2. Dann: "KARTE DER GEGENWART: ${cards[1]} [dann dein Text]"
3. Dann: "KARTE DER ZUKUNFT: ${cards[2]} [dann dein Text]"
4. Dann: "KARTE DER HERAUSFORDERUNG: ${cards[3]} [dann dein Text]"
5. Dann: "KARTE DES ERGEBNISSES: ${cards[4]} [dann dein Text]"

KEINE anderen Einleitungen!
BEGINNE JEDEN Abschnitt mit "KARTE DER [POSITION]:"!
Das ist der TRIGGER für den Kartenwechsel!

WICHTIG - Schreibe eine spirituelle Deutung die:
1. ${userName} direkt und intim anspricht (verwende den Namen oft!)
2. JEDE EINZELNE KARTE ausführlich deutet mit ihrem EXAKTEN ENGLISCHEN NAMEN
3. Die SYMBOLIK jeder Karte poetisch beschreibt
4. Zeige wie die Karten ZUSAMMENWIRKEN und sich gegenseitig verstärken
5. Erkläre für JEDE Position was die jeweilige Karte dort bedeutet:
   - Vergangenheit: ${cards[0]} (erwähne "THE ${cards[0]}" mindestens 2x)
   - Gegenwart: ${cards[1]} (erwähne "THE ${cards[1]}" mindestens 2x)
   - Zukunft: ${cards[2]} (erwähne "${cards[2]}" mindestens 2x)
   - Herausforderung: ${cards[3]} (erwähne "${cards[3]}" mindestens 2x)
   - Rat/Outcome: ${cards[4]} (erwähne "${cards[4]}" mindestens 2x)
6. ${Object.keys(friendRoles).length > 0 ? `Die Person(en) ${Object.keys(friendRoles).join(' und ')} subtil als energetische Begleiter erwähnt (2-3 mal natürlich einstreuen)` : 'Keine Freunde erwähnen'}
7. Verwende mystische, poetische Sprache mit Handlungsbeschreibungen

STRUKTUR - VERWENDE DIESE EXAKTEN PHRASEN:

1. "KARTE DER VERGANGENHEIT: ${cards[0]}" - dann deine Deutung
2. "KARTE DER GEGENWART: ${cards[1]}" - dann deine Deutung
3. "KARTE DER ZUKUNFT: ${cards[2]}" - dann deine Deutung
4. "KARTE DER HERAUSFORDERUNG: ${cards[3]}" - dann deine Deutung
5. "KARTE DES ERGEBNISSES: ${cards[4]}" - dann deine Deutung

JEDER Abschnitt ca. 400-500 Zeichen.
Gesamt: 2000-2500 Zeichen.`;

      // DEBUG: Log what we're actually sending to Claude
      console.log('\n========= DEBUG CLAUDE API REQUEST =========');
      console.log('System prompt starts with:', systemPrompt.substring(0, 300));
      console.log('Has NIEMALS Katzen-Tarot?', systemPrompt.includes('NIEMALS "Katzen-Tarot"'));
      console.log('Has position markers?', systemPrompt.includes('KARTE DER VERGANGENHEIT:'));
      console.log('=============================================\n');

      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-5-haiku-latest',  // Using newer Haiku model for better quality
          max_tokens: 2500,
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