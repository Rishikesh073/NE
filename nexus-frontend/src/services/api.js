import axios from 'axios';
import { auth } from "./firebase"; // Adjust path if your firebase.js is in a different folder

const api = axios.create({
  baseURL: 'http://localhost:5000/api', // Points to your Node.js server
});

// Axios Interceptor: Automatically grabs the active user's token before every single API call
api.interceptors.request.use(
  async (config) => {
    if (auth.currentUser) {
      // Gets the secure, temporary ID token from Firebase
      const token = await auth.currentUser.getIdToken(true);
      // Attaches it to the request header
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;