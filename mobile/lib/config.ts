import { Platform } from 'react-native';

const DEV_MACHINE_IP = '10.183.25.195';

export const API_BASE_URL = __DEV__
  ? Platform.OS === 'ios'
    ? `http://${DEV_MACHINE_IP}:3005`
    : 'http://10.0.2.2:3005'
  : 'https://api.example.com';

export const WS_BASE_URL = __DEV__
  ? Platform.OS === 'ios'
    ? `ws://${DEV_MACHINE_IP}:3005`
    : 'ws://10.0.2.2:3005'
  : 'wss://api.example.com';
