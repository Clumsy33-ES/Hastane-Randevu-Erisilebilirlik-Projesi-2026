import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const apiClient = axios.create({
  baseURL: 'https://hospital-backend-gtgc.onrender.com',
  timeout: 60000,
});

// Request interceptor to automatically add token to authorization header
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.error('[API CLIENT] Error reading token from AsyncStorage:', e);
    }
    return config;
  },
  (error) => {
    console.error('[API CLIENT] Request Interceptor Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for clear and descriptive error logging
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error(
        `[API CLIENT] Response Error Status: ${error.response.status}`,
        JSON.stringify(error.response.data)
      );
    } else if (error.request) {
      console.error('[API CLIENT] Network Error - No Response Received:', error.request);
    } else {
      console.error('[API CLIENT] Request Setup Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default apiClient;
