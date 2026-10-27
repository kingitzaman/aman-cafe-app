# Aman's Café — Mobile App

Android और iOS दोनों के लिए React Native (Expo) ऐप। Backend: Supabase।

## Features
- Menu browse (category filter)
- Cart with quantity control
- Pickup / Delivery order (Supabase में save होता है)
- Table booking (date, time, guests, special request)

## Setup (पहली बार)

1. Node.js 20+ इंस्टॉल करो।
2. प्रोजेक्ट फ़ोल्डर में:
   ```
   npm install
   cp .env.example .env
   ```
3. `.env` खोलकर `EXPO_PUBLIC_SUPABASE_ANON_KEY` में अपनी **anon / publishable** key डालो।
   (Supabase Dashboard → Project Settings → API Keys). Service role key कभी मत डालना।
4. चलाओ:
   ```
   npx expo start
   ```
5. फ़ोन पर **Expo Go** ऐप से QR कोड स्कैन करो।

## APK बनाना (Android, टेस्ट के लिए)
```
npm install -g eas-cli
eas login
eas build -p android --profile preview
```
Build पूरा होने पर APK डाउनलोड लिंक मिलेगा।

## Database
Tables: `menu_items`, `orders`, `order_items`, `reservations`।
Schema और सैंपल menu Supabase migration में बना है।

## Security नोट
- App में सिर्फ anon key जाती है। RLS चालू है।
- Kitchen/staff screen और status बदलने का काम staff login के बाद ही होगा (अभी बाकी है)।

## Notes
- Repo private रखो।
- GitHub token कभी code या chat में मत डालो।
