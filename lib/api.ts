import { Platform } from 'react-native';

// On physical device, use your computer's LAN IP
// On simulator, localhost works
const DEV_MACHINE_IP = '10.183.25.195';

export const API_BASE_URL = __DEV__
  ? Platform.OS === 'ios'
    ? `http://${DEV_MACHINE_IP}:3000`
    : 'http://10.0.2.2:3000'
  : 'https://api.example.com';

export const api = {
  baseUrl: API_BASE_URL,
};
