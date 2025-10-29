const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// API Keys - Replicate ist optional, wir nutzen erstmal Wavespeed
const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY;
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

// Storage file path für persistente Voice Clones
const STORAGE_FILE = path.join(__dirname, 'voice-clones-storage.json');

// Conditional Replicate import
let Replicate;
try {
  Replicate = require('replicate');
} catch (e) {
  console.log('Replicate package not found, using fallback mode');
}

class VoiceCloningService {
  constructor() {
    if (Replicate && REPLICATE_API_KEY) {
      console.log('🚀 Initializing Replicate with Voice Cloning...');
      this.replicate = new Replicate({
        auth: REPLICATE_API_KEY,
      });
    } else {
      if (!REPLICATE_API_KEY) {
        console.log('⚠️ No Replicate API key found');
      }
      if (!Replicate) {
        console.log('⚠️ Replicate package not loaded');
      }
      console.log('Running in Wavespeed-only mode (no Replicate)');
      this.replicate = null;
    }

    // Store user voice embeddings (in production, use database)
    this.userVoiceEmbeddings = new Map();

    // Load persisted voice clones on startup
    this.loadPersistedVoiceClones();
  }

  /**
   * Load persisted voice clones from file
   */
  async loadPersistedVoiceClones() {
    try {
      const data = await fs.readFile(STORAGE_FILE, 'utf-8');
      const storedClones = JSON.parse(data);

      // Restore voice clones to memory
      Object.entries(storedClones).forEach(([userId, voiceData]) => {
        this.userVoiceEmbeddings.set(userId, voiceData);
        console.log(`📂 Loaded voice clone for user: ${userId} with Voice ID: ${voiceData.embedding?.voiceId}`);
      });

      console.log(`✅ Loaded ${this.userVoiceEmbeddings.size} voice clones from storage`);
    } catch (error) {
      // File doesn't exist yet, that's ok
      if (error.code !== 'ENOENT') {
        console.error('Error loading voice clones:', error);
      }
    }
  }

  /**
   * Save voice clones to persistent storage
   */
  async saveVoiceClones() {
    try {
      const toStore = {};
      this.userVoiceEmbeddings.forEach((value, key) => {
        toStore[key] = value;
      });

      await fs.writeFile(STORAGE_FILE, JSON.stringify(toStore, null, 2));
      console.log(`💾 Saved ${this.userVoiceEmbeddings.size} voice clones to storage`);
    } catch (error) {
      console.error('Error saving voice clones:', error);
    }
  }

  /**
   * Create voice embedding from user audio recording
   * @param {String} audioBase64 - Base64 encoded audio (10-15 seconds)
   * @param {String} userId - User identifier
   * @returns {Object} Voice embedding and metadata
   */
  async createVoiceClone(audioBase64, userId) {
    try {
      console.log(`🎤 Voice clone request for user: ${userId}`);

      // WICHTIG: Prüfe ob bereits eine Voice Clone existiert!
      if (this.userVoiceEmbeddings.has(userId)) {
        const existingVoice = this.userVoiceEmbeddings.get(userId);
        console.log(`✅ Voice clone already exists for user: ${userId} with Voice ID: ${existingVoice.embedding.voiceId}`);
        return {
          success: true,
          userId: userId,
          embeddingId: `voice_${userId}_existing`,
          message: 'Voice clone already exists',
          voiceId: existingVoice.embedding.voiceId,
          metadata: {
            createdAt: existingVoice.createdAt,
            sampleDuration: existingVoice.sampleDuration,
            language: existingVoice.language,
            mode: 'existing'
          }
        };
      }

      console.log(`🎤 Creating NEW voice clone for user: ${userId}`);
      let voiceEmbedding;

      // Use Wavespeed MiniMax Voice Clone API
      if (WAVESPEED_API_KEY) {
        try {
          console.log('🔄 Creating voice clone with Wavespeed MiniMax...');

          // Create a unique voice ID for this user
          const customVoiceId = `WaveUser${userId.substring(0, 8).replace(/-/g, '')}`;
          console.log(`Creating voice with ID: ${customVoiceId}`);

          // Create the audio data URL
          const audioDataUrl = `data:audio/wav;base64,${audioBase64}`;

          // Call Wavespeed Voice Clone API with JSON body
          const response = await axios.post(
            'https://api.wavespeed.ai/api/v3/minimax/voice-clone',
            {
              audio: audioDataUrl,  // Audio as base64 data URL string
              custom_voice_id: customVoiceId,
              model: 'speech-02-hd',
              need_noise_reduction: false,
              need_volume_normalization: true,
              accuracy: 0.7,
              text: 'Hallo! Das ist meine geklonte Stimme. Ich kann jetzt alle Texte mit meiner eigenen Stimme sprechen!'
            },
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
            console.log('⏳ Polling for voice clone result...');

            for (let attempts = 0; attempts < 30; attempts++) {
              await new Promise(resolve => setTimeout(resolve, 2000));

              const pollResponse = await axios.get(result.urls.get, {
                headers: {
                  'Authorization': `Bearer ${WAVESPEED_API_KEY}`
                }
              });

              const pollResult = pollResponse.data.data || pollResponse.data;

              if (pollResult.status === 'completed') {
                console.log(`✅ Voice clone created successfully! Voice ID: ${customVoiceId}`);
                console.log('Preview URL:', pollResult.outputs?.[0]);

                voiceEmbedding = {
                  type: 'wavespeed_minimax',
                  voiceId: customVoiceId,
                  previewUrl: pollResult.outputs?.[0],
                  createdAt: new Date().toISOString()
                };
                break;
              } else if (pollResult.status === 'failed' || pollResult.status === 'error') {
                throw new Error(pollResult.error || 'Voice cloning failed');
              }
            }
          }

          if (!voiceEmbedding) {
            throw new Error('Voice clone creation timed out');
          }

        } catch (wavespeedError) {
          console.error('Wavespeed MiniMax error:', wavespeedError);
          console.log('Falling back to mock embedding');
          voiceEmbedding = this.createMockEmbedding(audioBase64);
        }
      } else {
        console.log('⚠️ No Wavespeed API key found, using mock embedding');
        voiceEmbedding = this.createMockEmbedding(audioBase64);
      }

      // Store embedding for user
      this.userVoiceEmbeddings.set(userId, {
        embedding: voiceEmbedding,
        audioSample: audioBase64.substring(0, 1000), // Store small sample
        createdAt: new Date().toISOString(),
        sampleDuration: 10, // seconds
        language: 'de'
      });

      // WICHTIG: Save to persistent storage!
      await this.saveVoiceClones();

      console.log(`✅ Voice clone created and saved for user: ${userId}`);

      // Get the voice ID from the embedding
      const voiceId = voiceEmbedding?.voiceId || null;

      return {
        success: true,
        userId: userId,
        voiceId: voiceId,  // WICHTIG: Voice ID im Response zurückgeben!
        embeddingId: `voice_${userId}_${Date.now()}`,
        message: 'Voice clone created successfully',
        metadata: {
          createdAt: new Date().toISOString(),
          sampleDuration: 10,
          language: 'de',
          mode: voiceEmbedding?.type || 'mock'
        }
      };

    } catch (error) {
      console.error('Voice cloning error:', error);
      throw error;
    }
  }

  createMockEmbedding(audioBase64) {
    // Create a deterministic mock embedding based on audio sample
    // This ensures the same audio always produces the same "embedding"
    const sampleHash = audioBase64.substring(0, 20);
    let hash = 0;
    for (let i = 0; i < sampleHash.length; i++) {
      hash = ((hash << 5) - hash) + sampleHash.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }

    // Generate deterministic random numbers based on hash
    const mockData = Array(256).fill(0).map((_, i) => {
      const seed = hash + i;
      return (Math.sin(seed) * 10000) % 1;
    });

    return {
      type: 'mock',
      data: mockData,
      hash: hash
    };
  }

  /**
   * Generate speech using cloned voice
   * @param {String} text - Text to synthesize
   * @param {String} userId - User identifier
   * @param {String} emotion - Emotion style (happy, neutral, sad, etc.)
   * @returns {Object} Audio URL and metadata
   */
  async generateWithClonedVoice(text, userId, emotion = 'neutral') {
    try {
      console.log(`🗣️ Generating speech with cloned voice for user: ${userId}`);

      // Get user's voice embedding
      const userVoiceData = this.userVoiceEmbeddings.get(userId);

      if (!userVoiceData) {
        throw new Error(`No voice clone found for user: ${userId}`);
      }

      // Dynamische Emotion auswählen wenn nicht spezifisch angegeben
      if (emotion === 'neutral') {
        const dynamicEmotions = ['happy', 'surprised', 'happy'];  // 2x happy für höhere Wahrscheinlichkeit
        emotion = dynamicEmotions[Math.floor(Math.random() * dynamicEmotions.length)];
        console.log(`🎭 Dynamisch gewählte Emotion: ${emotion}`);
      }

      // Use Wavespeed MiniMax with the cloned voice
      if (userVoiceData.embedding.type === 'wavespeed_minimax' && userVoiceData.embedding.voiceId) {
        try {
          console.log(`🎯 Generating with Wavespeed MiniMax Voice ID: ${userVoiceData.embedding.voiceId}`);

          // Use the cloned voice ID with MiniMax TTS
          const response = await axios.post(
            'https://api.wavespeed.ai/api/v3/minimax/speech-02-hd',
            {
              text: text,
              voice_id: userVoiceData.embedding.voiceId, // Use the cloned voice ID!
              speed: 1.0,
              volume: 1.5,  // ERHÖHT von 1.0 auf 1.5 für mehr Präsenz!
              pitch: 0,
              emotion: emotion,
              sample_rate: 44100,
              bitrate: 128000,
              english_normalization: false
            },
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
            console.log('⏳ Generating speech with cloned voice...');

            for (let attempts = 0; attempts < 30; attempts++) {
              await new Promise(resolve => setTimeout(resolve, 1000));

              const pollResponse = await axios.get(result.urls.get, {
                headers: {
                  'Authorization': `Bearer ${WAVESPEED_API_KEY}`
                }
              });

              const pollResult = pollResponse.data.data || pollResponse.data;

              if (pollResult.status === 'completed' && pollResult.outputs?.length > 0) {
                console.log('✅ Speech generated with YOUR cloned voice!');
                return {
                  success: true,
                  audioUrl: pollResult.outputs[0],
                  text: text,
                  emotion: emotion,
                  userId: userId,
                  clonedVoice: true,
                  voiceId: userVoiceData.embedding.voiceId,
                  generatedAt: new Date().toISOString()
                };
              } else if (pollResult.status === 'failed' || pollResult.status === 'error') {
                throw new Error(pollResult.error || 'Voice generation failed');
              }
            }
          }

          throw new Error('Voice generation timed out');

        } catch (error) {
          console.error('Wavespeed MiniMax TTS error:', error);
          console.log('Falling back to standard voice...');
          // Fall through to standard Wavespeed
        }
      }

      // Use Wavespeed with personalized settings based on "embedding"
      // We'll vary the voice slightly based on the user's mock embedding
      const embedData = userVoiceData.embedding.data || [];
      const voiceVariation = embedData[0] || 0.5;

      // Select voice based on embedding "personality"
      // Using voice IDs that work in our other services
      let voiceId = "German_SweetLady";
      if (voiceVariation < 0.5) {
        // For now, use the same female voice since male voices aren't working
        voiceId = "German_SweetLady";
      } else {
        voiceId = "German_SweetLady";
      }

      // Adjust speed and pitch based on embedding
      const speed = 0.9 + (embedData[1] || 0.5) * 0.3; // Range: 0.9 - 1.2
      const pitch = Math.round(-2 + (embedData[2] || 0.5) * 4); // Range: -2 to +2, rounded to integer

      console.log(`Using personalized voice settings: ${voiceId}, speed: ${speed}, pitch: ${pitch}`);

      return this.generatePersonalizedWavespeed(text, emotion, voiceId, speed, pitch, userId);

    } catch (error) {
      console.error('Speech generation with cloned voice error:', error);

      // Fallback to standard Wavespeed
      return this.fallbackToWavespeed(text, emotion);
    }
  }

  async generatePersonalizedWavespeed(text, emotion, voiceId, speed, pitch, userId) {
    try {
      console.log(`🔊 Generating personalized Wavespeed audio for user: ${userId}`);

      const response = await axios.post(
        'https://api.wavespeed.ai/api/v3/minimax/speech-02-hd',
        {
          text: text,
          voice_id: voiceId,
          speed: speed,
          volume: 1.5,  // ERHÖHT für mehr Präsenz!
          pitch: pitch,
          emotion: emotion,
          sample_rate: 44100,
          bitrate: 128000,
          english_normalization: false
        },
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
        console.log('Polling for personalized voice result...');

        for (let attempts = 0; attempts < 30; attempts++) {
          await new Promise(resolve => setTimeout(resolve, 1000));

          const pollResponse = await axios.get(result.urls.get, {
            headers: {
              'Authorization': `Bearer ${WAVESPEED_API_KEY}`
            }
          });

          const pollResult = pollResponse.data.data || pollResponse.data;

          if (pollResult.status === 'completed' && pollResult.outputs?.length > 0) {
            return {
              success: true,
              audioUrl: pollResult.outputs[0],
              text: text,
              emotion: emotion,
              userId: userId,
              personalized: true,
              generatedAt: new Date().toISOString()
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
          success: true,
          audioUrl: result.outputs[0],
          text: text,
          emotion: emotion,
          userId: userId,
          personalized: true,
          generatedAt: new Date().toISOString()
        };
      }

      throw new Error('No audio data received');

    } catch (error) {
      console.error('Personalized Wavespeed generation error:', error);
      throw error;
    }
  }

  /**
   * Fallback to Wavespeed TTS if voice cloning fails
   */
  async fallbackToWavespeed(text, emotion = 'neutral') {
    try {
      console.log('⚠️ Falling back to Wavespeed TTS...');

      // Dynamische Emotion auch für Fallback
      if (emotion === 'neutral') {
        const dynamicEmotions = ['happy', 'surprised', 'happy'];
        emotion = dynamicEmotions[Math.floor(Math.random() * dynamicEmotions.length)];
        console.log(`🎭 Fallback mit dynamischer Emotion: ${emotion}`);
      }

      const response = await axios.post(
        'https://api.wavespeed.ai/api/v3/minimax/speech-02-hd',
        {
          text: text,
          voice_id: "German_SweetLady",
          speed: 1.0,
          volume: 1.5,  // ERHÖHT für mehr Präsenz!
          pitch: 0,
          emotion: emotion,
          sample_rate: 44100,
          bitrate: 128000,
          english_normalization: false
        },
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
        console.log('Polling for Wavespeed result...');

        for (let attempts = 0; attempts < 30; attempts++) {
          await new Promise(resolve => setTimeout(resolve, 1000));

          const pollResponse = await axios.get(result.urls.get, {
            headers: {
              'Authorization': `Bearer ${WAVESPEED_API_KEY}`
            }
          });

          const pollResult = pollResponse.data.data || pollResponse.data;

          if (pollResult.status === 'completed' && pollResult.outputs?.length > 0) {
            return {
              success: true,
              audioUrl: pollResult.outputs[0],
              text: text,
              emotion: emotion,
              fallback: true,
              generatedAt: new Date().toISOString()
            };
          }
        }
      }

      throw new Error('Wavespeed fallback failed');

    } catch (error) {
      console.error('Wavespeed fallback error:', error);
      throw error;
    }
  }

  /**
   * Test voice clone with sample text
   */
  async testVoiceClone(userId) {
    const testTexts = [
      "WOW! Das ist ja MEINE Stimme! Kannst du das glauben? Das klingt wirklich wie ich!",
      "Ich bin SO aufgeregt! Meine eigene Stimme wurde gerade geklont und es ist FANTASTISCH!",
      "OH MEIN GOTT! Das ist unglaublich! Ich höre mich selbst sprechen! Die Technologie ist der WAHNSINN!",
      "YESSS! Das funktioniert wirklich! Ich kann jetzt mit meiner eigenen Stimme antworten! Wie cool ist das denn?"
    ];

    const randomText = testTexts[Math.floor(Math.random() * testTexts.length)];

    // Nutze immer 'happy' oder 'surprised' für Tests
    const testEmotions = ['happy', 'surprised'];
    const emotion = testEmotions[Math.floor(Math.random() * testEmotions.length)];

    return this.generateWithClonedVoice(randomText, userId, emotion);
  }

  /**
   * Delete voice clone for user
   */
  async deleteVoiceClone(userId) {
    if (this.userVoiceEmbeddings.has(userId)) {
      this.userVoiceEmbeddings.delete(userId);

      // Save changes to persistent storage
      await this.saveVoiceClones();

      return {
        success: true,
        message: `Voice clone deleted for user: ${userId}`
      };
    }

    return {
      success: false,
      message: `No voice clone found for user: ${userId}`
    };
  }

  /**
   * Get voice clone status for user
   */
  getVoiceCloneStatus(userId) {
    const voiceData = this.userVoiceEmbeddings.get(userId);

    if (!voiceData) {
      return {
        hasVoiceClone: false,
        userId: userId
      };
    }

    return {
      hasVoiceClone: true,
      userId: userId,
      createdAt: voiceData.createdAt,
      sampleDuration: voiceData.sampleDuration,
      language: voiceData.language
    };
  }

  /**
   * Generate quiz answer with user's cloned voice
   */
  async generateQuizAnswerWithClone(userId, question, answerText) {
    try {
      console.log(`🎯 Generating quiz answer with cloned voice`);
      console.log(`User: ${userId}`);
      console.log(`Question: ${question}`);
      console.log(`Answer: ${answerText}`);

      // Check if user has voice clone
      const status = this.getVoiceCloneStatus(userId);

      if (!status.hasVoiceClone) {
        console.log('No voice clone found, using default voice');
        return this.fallbackToWavespeed(answerText, 'happy');
      }

      // Generate with cloned voice
      const result = await this.generateWithClonedVoice(
        answerText,
        userId,
        'happy' // Quiz answers should be upbeat
      );

      return {
        ...result,
        question: question,
        answerText: answerText
      };

    } catch (error) {
      console.error('Error generating quiz answer with clone:', error);
      return this.fallbackToWavespeed(answerText, 'happy');
    }
  }
}

module.exports = VoiceCloningService;