// API Configuration for different environments
const getApiUrl = () => {
  // Check if we have a specific API URL set
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // In production, use the same origin (works for full-stack deployments)
  if (process.env.NODE_ENV === 'production') {
    return window.location.origin;
  }
  
  // Development default
  return 'http://localhost:5000';
};

export const API_BASE_URL = getApiUrl();

// API endpoints
export const API_ENDPOINTS = {
  // Auth endpoints
  REGISTER: `${API_BASE_URL}/api/user/register`,
  LOGIN: `${API_BASE_URL}/api/user/login`,
  RESET_PASSWORD: `${API_BASE_URL}/api/user/reset-password`,
  
  // Portfolio endpoints
  SAVE_PORTFOLIO: `${API_BASE_URL}/api/portfolio/save`,
  PUBLISH_PORTFOLIO: `${API_BASE_URL}/api/portfolio/publish`,
  GET_PORTFOLIO: `${API_BASE_URL}/api/portfolio/my-portfolio`,
  
  // Upload endpoints
  UPLOAD_PROFILE_IMAGE: `${API_BASE_URL}/api/upload/profile-image`,
  UPLOAD_PROJECT_IMAGE: `${API_BASE_URL}/api/upload/project-image`,
  UPLOAD_CERTIFICATE_IMAGE: `${API_BASE_URL}/api/upload/certificate-image`,
  UPLOAD_RESUME: `${API_BASE_URL}/api/upload/resume`,
};

// Helper function for making API calls
export const apiCall = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
  };
  
  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };
  
  try {
    const response = await fetch(url, mergedOptions);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};

export default { API_BASE_URL, API_ENDPOINTS, apiCall };