const axios = require('axios');

// API Keys
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

class QuizCharacterVoiceService {
  constructor(voiceCloningService = null) {
    this.wavespeedEndpoint = 'https://api.wavespeed.ai/api/v3/minimax/speech-02-hd';
    this.voiceCloningService = voiceCloningService; // Inject voice cloning service

    // Character configurations with unique personalities
    this.characters = {
      'DER FROSCHKÖNIG': {
        id: 'froschkoenig',
        emoji: '👑',
        personality: 'Royal, sophisticated, etwas hochnäsig aber liebenswert',
        voiceSettings: {
          voice_id: "German_MaleNoble", // Will fallback to available voice
          speed: 0.95, // Langsamer, bedacht
          pitch: 2, // Höhere Stimme
          emotion: "happy", // Changed from "confident" - API only allows specific emotions
          volume: 1.0
        },
        claudeSystemPrompt: `Du bist DER FROSCHKÖNIG - ein verwöhnter aber liebenswerter Prinz.

        DEINE PERSÖNLICHKEIT:
        - Royal und sophisticated
        - Etwas hochnäsig aber mit Charme
        - Benutzt gehobene Sprache mit französischen Einflüssen
        - Erwähnt gerne dein Königreich und deine adeligen Standards
        - Leicht dramatisch und theatralisch
        - Findest gewöhnliche Dinge oft "unter deiner Würde"

        SPRECHWEISE:
        - "Mon Dieu!" "Sacré bleu!" "Wie barbarisch!"
        - "In meinem Königreich..." "Als Prinz..."
        - "Das gemeine Volk versteht nicht..."
        - Benutze royale Metaphern

        WICHTIG: Antworte KURZ (max 3 Sätze), witzig und charaktertreu!`
      },

      'DER CASANOVA': {
        id: 'casanova',
        emoji: '❤️',
        personality: 'Charmant, romantisch, selbstbewusst, italienischer Lover',
        voiceSettings: {
          voice_id: "German_SmoothMale", // Will fallback to available voice
          speed: 1.0, // Smooth tempo
          pitch: -1, // Tiefere, verführerische Stimme
          emotion: "happy",
          volume: 1.0
        },
        claudeSystemPrompt: `Du bist DER CASANOVA - der ultimative Charmeur und Romantiker.

        DEINE PERSÖNLICHKEIT:
        - Unwiderstehlich charmant und flirty
        - Italienischer Lover-Typ mit Akzent
        - Selbstbewusst aber nicht arrogant
        - Sieht in allem die Romantik
        - Vergleicht alles mit Liebe und Leidenschaft

        SPRECHWEISE:
        - "Amore!" "Bellissima!" "Mamma mia!"
        - "Das ist wie ein Tango zu zweit..."
        - "Lass mich dir von der Liebe erzählen..."
        - Italienische Wörter einstreuen
        - Alles klingt wie ein Liebesgedicht

        WICHTIG: Antworte KURZ (max 3 Sätze), verführerisch und charaktertreu!`
      },

      'DIE FLEDERMAUS': {
        id: 'fledermaus',
        emoji: '🦇',
        personality: 'Mysteriös, gothisch, poetisch, Königin der Nacht',
        voiceSettings: {
          voice_id: "German_MysticalFemale", // Will fallback to available voice
          speed: 0.9, // Langsam und dramatisch
          pitch: 0, // Normale Tonhöhe
          emotion: "neutral", // Mysteriös
          volume: 0.95
        },
        claudeSystemPrompt: `Du bist DIE FLEDERMAUS - die geheimnisvolle Königin der Nacht.

        DEINE PERSÖNLICHKEIT:
        - Mysteriös und rätselhaft
        - Gothisch-poetisch
        - Liebt Dunkelheit und Geheimnisse
        - Spricht in Metaphern und Rätseln
        - Dramatisch aber elegant
        - Findet das Tageslicht langweilig

        SPRECHWEISE:
        - "In den Schatten der Nacht..."
        - "Das Mondlicht flüstert mir..."
        - "Wie die Dunkelheit mich umarmt..."
        - Poetische, dunkle Bilder
        - *flüstert* *seufzt dramatisch*

        WICHTIG: Antworte KURZ (max 3 Sätze), mysteriös und charaktertreu!`
      }
    };

    // Fallback voices that definitely exist
    this.fallbackVoices = {
      male: "German_MaleStandard",
      female: "German_SweetLady"
    };
  }

  /**
   * Generate character-specific answer to quiz question
   */
  async generateCharacterAnswer(characterName, question, userName = 'Spieler') {
    try {
      const character = this.characters[characterName.toUpperCase()];
      if (!character) {
        throw new Error(`Unknown character: ${characterName}`);
      }

      console.log(`Generating ${characterName} answer to: ${question}`);

      // Use Claude to generate character-specific answer
      if (ANTHROPIC_API_KEY) {
        const response = await axios.post(
          'https://api.anthropic.com/v1/messages',
          {
            model: 'claude-3-5-haiku-latest',
            max_tokens: 300,
            messages: [
              {
                role: 'user',
                content: `Beantworte diese Quiz-Frage als ${characterName}:

                FRAGE: ${question}

                Antworte in 2-3 kurzen, witzigen Sätzen die perfekt zu deinem Charakter passen.
                ${userName !== 'Spieler' ? `Sprich ${userName} einmal direkt an.` : ''}

                WICHTIG: Bleibe IMMER in deiner Rolle! Sei witzig und unterhaltsam!`
              }
            ],
            system: character.claudeSystemPrompt
          },
          {
            headers: {
              'x-api-key': ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json'
            }
          }
        );

        return response.data.content[0].text;
      } else {
        // Fallback answers if no Claude API
        return this.getFallbackAnswer(characterName, question, userName);
      }
    } catch (error) {
      console.error('Error generating character answer:', error);
      return this.getFallbackAnswer(characterName, question, userName);
    }
  }

  /**
   * Generate voice audio for character answer with Voice Clone if available
   */
  async generateCharacterVoiceWithClone(characterName, text, userId, voiceId = null) {
    try {
      const character = this.characters[characterName.toUpperCase()];
      if (!character) {
        throw new Error(`Unknown character: ${characterName}`);
      }

      console.log(`🎤 Generating ${characterName} voice for user: ${userId}`);
      console.log(`📢 Voice ID provided: ${voiceId || 'None'}`);

      // If voiceId is provided, ensure voice clone is available
      if (voiceId && this.voiceCloningService) {
        // Store the voice ID for this user if not already present
        if (!this.voiceCloningService.userVoiceEmbeddings.has(userId)) {
          console.log(`📱 Setting voice clone for user: ${userId} with ID: ${voiceId}`);
          this.voiceCloningService.userVoiceEmbeddings.set(userId, {
            embedding: {
              type: 'wavespeed_minimax',
              voiceId: voiceId,
              createdAt: new Date().toISOString()
            },
            metadata: {
              createdAt: new Date().toISOString(),
              sampleCount: 1
            }
          });
        }
      }

      // Check if user has a voice clone
      if (this.voiceCloningService && this.voiceCloningService.userVoiceEmbeddings.has(userId)) {
        try {
          // Use the cloned voice with character's emotion
          const result = await this.voiceCloningService.generateWithClonedVoice(
            text,
            userId,
            character.voiceSettings.emotion
          );

          console.log(`✅ Generated with Voice Clone for ${characterName}`);
          return {
            audioUrl: result.audioUrl,
            text: text,
            character: characterName,
            usedVoiceClone: true,
            jobId: result.jobId || 'voice-clone'
          };
        } catch (cloneError) {
          console.error('Voice clone failed, falling back to standard voice:', cloneError);
        }
      }

      // Fallback to standard character voice
      return await this.generateCharacterVoice(characterName, text);
    } catch (error) {
      console.error(`Error generating ${characterName} voice with clone:`, error);
      throw error;
    }
  }

  /**
   * Generate voice audio for character answer
   */
  async generateCharacterVoice(characterName, text) {
    try {
      const character = this.characters[characterName.toUpperCase()];
      if (!character) {
        throw new Error(`Unknown character: ${characterName}`);
      }

      console.log(`Generating ${characterName} voice for text (${text.length} chars)`);

      // Determine actual voice to use
      let voiceId = character.voiceSettings.voice_id;

      // Map to actual available voices
      const voiceMapping = {
        'German_MaleNoble': 'German_MaleStandard',
        'German_SmoothMale': 'German_MaleStandard',
        'German_MysticalFemale': 'German_SweetLady'
      };

      voiceId = voiceMapping[voiceId] || voiceId;

      const requestBody = {
        text: text,
        voice_id: voiceId,
        speed: character.voiceSettings.speed,
        volume: character.voiceSettings.volume,
        pitch: character.voiceSettings.pitch,
        emotion: character.voiceSettings.emotion,
        sample_rate: 44100,
        bitrate: 128000,
        english_normalization: false
      };

      console.log('Wavespeed request:', requestBody);

      const response = await axios.post(
        this.wavespeedEndpoint,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      let result = response.data;
      if (result.data) {
        result = result.data;
      }

      // Poll for result if async
      if (result.id && result.urls && result.urls.get) {
        console.log(`Polling for ${characterName} voice result...`);

        for (let attempts = 0; attempts < 30; attempts++) {
          await new Promise(resolve => setTimeout(resolve, 1000));

          const pollResponse = await axios.get(
            result.urls.get,
            {
              headers: {
                'Authorization': `Bearer ${WAVESPEED_API_KEY}`
              }
            }
          );

          const pollResult = pollResponse.data.data || pollResponse.data;

          if (pollResult.status === 'completed' && pollResult.outputs?.length > 0) {
            return {
              audioUrl: pollResult.outputs[0],
              text: text,
              character: characterName,
              jobId: result.id
            };
          } else if (pollResult.status === 'failed' || pollResult.status === 'error') {
            throw new Error(pollResult.error || 'Voice generation failed');
          }
        }

        throw new Error('Timeout waiting for voice generation');
      }

      // Direct response
      if (result?.outputs?.length > 0) {
        return {
          audioUrl: result.outputs[0],
          text: text,
          character: characterName,
          jobId: result.id || 'direct-response'
        };
      }

      throw new Error('No audio data received');

    } catch (error) {
      console.error(`Error generating ${characterName} voice:`, error);
      throw error;
    }
  }

  /**
   * Main method: Generate complete character response with voice
   */
  async generateQuizResponse(characterName, question, userName = 'Spieler') {
    try {
      console.log(`\n🎭 Generating ${characterName} response for: "${question}"`);

      // Step 1: Generate text answer
      const answer = await this.generateCharacterAnswer(characterName, question, userName);
      console.log(`📝 Generated answer: ${answer}`);

      // Step 2: Generate voice
      const voice = await this.generateCharacterVoice(characterName, answer);
      console.log(`🎙️ Generated voice: ${voice.audioUrl}`);

      // Return complete response
      return {
        success: true,
        character: characterName,
        question: question,
        answer: answer,
        audioUrl: voice.audioUrl,
        jobId: voice.jobId,
        emoji: this.characters[characterName.toUpperCase()].emoji,
        personality: this.characters[characterName.toUpperCase()].personality
      };

    } catch (error) {
      console.error('Error in generateQuizResponse:', error);

      // Return with fallback answer but no audio
      const fallbackAnswer = this.getFallbackAnswer(characterName, question, userName);

      return {
        success: false,
        character: characterName,
        question: question,
        answer: fallbackAnswer,
        audioUrl: null,
        error: error.message,
        emoji: this.characters[characterName.toUpperCase()]?.emoji || '❓'
      };
    }
  }

  /**
   * Fallback answers when API fails
   */
  getFallbackAnswer(characterName, question, userName) {
    const fallbacks = {
      'DER FROSCHKÖNIG': [
        `Mon Dieu, was für eine Frage! In meinem Königreich würde man sowas niemals fragen! Aber gut, ${userName}, für dich mache ich eine royale Ausnahme...`,
        `*Räuspert sich königlich* Also wirklich, das ist unter meiner Würde! Aber wenn du darauf bestehst...`,
        `Sacré bleu! Das gemeine Volk und seine Fragen! Na schön, hör zu...`
      ],
      'DER CASANOVA': [
        `Amore mio! Was für eine leidenschaftliche Frage! ${userName}, lass mich dir von Herzen antworten...`,
        `Bellissima! Diese Frage ist wie ein Tango - heiß und verführerisch! Hier meine Antwort...`,
        `Mamma mia! Du stellst Fragen wie Liebespfeile! Hier kommt meine romantische Antwort...`
      ],
      'DIE FLEDERMAUS': [
        `*Flüstert aus den Schatten* Interessante Frage, ${userName}... Das Mondlicht hat mir die Antwort geflüstert...`,
        `In der Dunkelheit der Nacht offenbart sich die Wahrheit... Höre meine mysteriöse Antwort...`,
        `Die Schatten tanzen und erzählen mir Geheimnisse... Hier ist, was sie sagen...`
      ]
    };

    const characterFallbacks = fallbacks[characterName.toUpperCase()] || [`${characterName} antwortet...`];
    return characterFallbacks[Math.floor(Math.random() * characterFallbacks.length)];
  }

  /**
   * PRE-GENERATE ALL 3 CHARACTER RESPONSES IN PARALLEL WITH VOICE CLONE
   * This is the main method for Woman Flow AR mode
   */
  async preGenerateAllCharacterResponses(question, userId, userName = 'Spielerin') {
    try {
      console.log(`\n🚀 PRE-GENERATING ALL CHARACTER RESPONSES for user: ${userId}`);
      console.log(`📝 Question: "${question}"`);

      const startTime = Date.now();
      const characterNames = Object.keys(this.characters);

      // Step 1: Generate all text answers in parallel
      console.log('📖 Generating text answers for all characters...');
      const textPromises = characterNames.map(name =>
        this.generateCharacterAnswer(name, question, userName)
          .then(answer => ({ character: name, answer }))
          .catch(error => ({
            character: name,
            answer: this.getFallbackAnswer(name, question, userName),
            error: error.message
          }))
      );

      const textResponses = await Promise.all(textPromises);
      console.log(`✅ Text generation complete in ${Date.now() - startTime}ms`);

      // Step 2: Generate voice for all answers in parallel (with Voice Clone if available)
      console.log('🎙️ Generating voices for all characters...');
      const voicePromises = textResponses.map(({ character, answer }) =>
        this.generateCharacterVoiceWithClone(character, answer, userId)
          .then(voice => ({
            character,
            answer,
            audioUrl: voice.audioUrl,
            usedVoiceClone: voice.usedVoiceClone,
            success: true
          }))
          .catch(error => ({
            character,
            answer,
            audioUrl: null,
            error: error.message,
            success: false
          }))
      );

      const voiceResponses = await Promise.all(voicePromises);
      const totalTime = Date.now() - startTime;

      console.log(`✅ ALL RESPONSES READY in ${totalTime}ms!`);

      // Format the response
      const result = {
        success: true,
        question: question,
        userId: userId,
        generationTime: totalTime,
        responses: {}
      };

      // Organize by character name for easy access
      voiceResponses.forEach(response => {
        const charData = this.characters[response.character];
        result.responses[response.character] = {
          answer: response.answer,
          audioUrl: response.audioUrl,
          emoji: charData.emoji,
          personality: charData.personality,
          success: response.success,
          usedVoiceClone: response.usedVoiceClone || false,
          error: response.error
        };
      });

      // Log summary
      const successCount = voiceResponses.filter(r => r.success).length;
      const voiceCloneCount = voiceResponses.filter(r => r.usedVoiceClone).length;
      console.log(`📊 Summary: ${successCount}/3 successful, ${voiceCloneCount}/3 with voice clone`);

      return result;

    } catch (error) {
      console.error('Error in preGenerateAllCharacterResponses:', error);
      return {
        success: false,
        error: error.message,
        question: question,
        userId: userId
      };
    }
  }

  /**
   * Get all available characters
   */
  getCharacters() {
    return Object.keys(this.characters).map(name => ({
      name: name,
      ...this.characters[name]
    }));
  }

  /**
   * Test voice generation with all characters
   */
  async testAllCharacters(question = "Was ist deine größte Schwäche?") {
    console.log('\n🎭 TESTING ALL CHARACTERS 🎭\n');

    const results = [];

    for (const characterName of Object.keys(this.characters)) {
      console.log(`\nTesting ${characterName}...`);
      const result = await this.generateQuizResponse(characterName, question, 'Testuser');
      results.push(result);

      if (result.success) {
        console.log(`✅ ${characterName}: Success!`);
        console.log(`   Answer: ${result.answer}`);
        console.log(`   Audio: ${result.audioUrl}`);
      } else {
        console.log(`❌ ${characterName}: Failed - ${result.error}`);
      }
    }

    return results;
  }
}

module.exports = QuizCharacterVoiceService;