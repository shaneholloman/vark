# Troubleshooting

## OpenAI Provider

Make sure the models that you are requesting are available.

```sh
curl -H "Authorization: Bearer YOUR_API_KEY_HERE" https://api.openai.com/v1/models
```

## Google Cloud Speech-to-Text Provider

### "API has not been used in project before or it is disabled"

If you see this error when using the Google provider:

```text
Google Cloud Speech-to-Text API has not been used in project [PROJECT_ID] before or it is disabled
```

**Solution:**

1. Go to the [Google Cloud Speech-to-Text API page](https://console.cloud.google.com/apis/library/speech.googleapis.com)
2. Select your project
3. Click **Enable**
4. Wait a few minutes for the API to activate

### "Requests to this API are blocked" / API_KEY_SERVICE_BLOCKED

If you see this error:

```text
Requests to this API speech.googleapis.com method google.cloud.speech.v1.Speech.Recognize are blocked
```

**Solution:**

Your API key has restrictions that prevent Speech-to-Text access:

1. Go to [Google Cloud Console API Credentials](https://console.cloud.google.com/apis/credentials)
2. Find your API key and click **Edit**
3. Under **API restrictions**:
   - Select **Don't restrict key**, OR
   - Select **Restrict key** and add **Cloud Speech-to-Text API** to the allowed APIs
4. Save changes and test again

### API Key Setup

1. Go to [Google Cloud Console API Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **Create Credentials** → **API Key**
3. Copy the generated key (format: `AIzaSy...`)
4. Ensure no restrictions block Speech-to-Text API access
