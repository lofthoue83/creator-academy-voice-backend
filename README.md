# Payment Backend Setup

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Stripe keys:**
   - Get your keys from https://dashboard.stripe.com/test/apikeys
   - Replace `sk_test_YOUR_SECRET_KEY_HERE` in server.js with your Stripe Secret Key
   - Replace `pk_test_YOUR_KEY_HERE` in PaymentManager.swift with your Stripe Publishable Key

3. **Run the server:**
   ```bash
   npm start
   ```
   Server will run on http://localhost:3000

## iOS App Configuration

1. **Update PaymentManager.swift:**
   - Set your Stripe publishable key
   - Ensure backend URL is correct (http://localhost:3000 for simulator)

2. **Apple Pay Setup:**
   - Enable Apple Pay capability in Xcode
   - Configure merchant ID: `merchant.com.creatoracademy.app`
   - Test with sandbox Apple Pay cards

## Testing

### Test Card Numbers:
- Success: 4242 4242 4242 4242
- Decline: 4000 0000 0000 0002
- 3D Secure: 4000 0025 0000 3155

### Apple Pay Testing:
- Use Xcode simulator with test cards
- Real device requires Apple Developer account

## Important Security Notes

⚠️ **Never commit real API keys to version control!**
- Use environment variables for production
- Regenerate any exposed keys immediately
- Keep secret keys on backend only