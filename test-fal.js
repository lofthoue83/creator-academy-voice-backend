const { fal } = require('@fal-ai/client');

// Configure fal.ai API key
const FAL_API_KEY = '4f3512f9-5b40-475c-863f-7e3c500dc8e9:7d7974bf5e2ea93da6d4630fec54edbd';
fal.config({
  credentials: FAL_API_KEY
});

async function testFal() {
  try {
    console.log('Testing fal.ai MiniMax Speech-02 HD...');

    const result = await fal.subscribe('fal-ai/minimax/speech-02-hd', {
      input: {
        text: "Willkommen zu deiner mystischen Tarot-Lesung.",
        voice_setting: {
          voice_id: 'Wise_Woman',
          speed: 0.9,
          vol: 1.0,
          pitch: -2
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: "mp3",
          channel: 2
        },
        output_format: "url"
      },
      logs: true,
      onQueueUpdate: (update) => {
        console.log('Queue update:', update);
      }
    });

    console.log('Success! Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
    if (error.body) {
      console.error('Error body:', error.body);
    }
    if (error.response) {
      console.error('Error response:', error.response);
    }
  }
}

testFal();