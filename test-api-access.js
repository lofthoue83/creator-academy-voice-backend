require('dotenv').config();
const axios = require('axios');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

async function testModel(modelName) {
  console.log(`\nTesting model: ${modelName}`);

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: modelName,
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Say "hello"'
          }
        ]
      },
      {
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ ${modelName} - SUCCESS`);
    console.log(`   Response: ${response.data.content[0].text}`);
    return true;
  } catch (error) {
    if (error.response) {
      console.log(`❌ ${modelName} - FAILED`);
      console.log(`   Error: ${error.response.data.error?.message || error.response.data}`);
    } else {
      console.log(`❌ ${modelName} - Network Error: ${error.message}`);
    }
    return false;
  }
}

async function main() {
  console.log('Testing Claude API Access with new key');
  console.log('API Key:', ANTHROPIC_API_KEY ? `${ANTHROPIC_API_KEY.substring(0, 20)}...` : 'NOT SET');
  console.log('=' .repeat(60));

  const models = [
    'claude-3-haiku-20240307',
    'claude-3-5-sonnet-20241022',
    'claude-3-sonnet-20240229',
    'claude-3-opus-20240229',
    'claude-3-5-sonnet-latest',
    'claude-3-5-haiku-latest'
  ];

  const results = {};

  for (const model of models) {
    results[model] = await testModel(model);
  }

  console.log('\n' + '=' .repeat(60));
  console.log('SUMMARY:');
  console.log('Available models:');
  for (const [model, success] of Object.entries(results)) {
    if (success) {
      console.log(`  ✅ ${model}`);
    }
  }

  console.log('\nUnavailable models:');
  for (const [model, success] of Object.entries(results)) {
    if (!success) {
      console.log(`  ❌ ${model}`);
    }
  }
}

main().catch(console.error);