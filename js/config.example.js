/**
 * OAuth configuration for trainer sync
 * Copy this file to config.js and add your credentials
 */

export const config = {
  google: {
    clientId: 'YOUR_GOOGLE_CLIENT_ID',
    apiKey: 'YOUR_GOOGLE_API_KEY'
  },
  redirectUri: window.location.origin + window.location.pathname
};
