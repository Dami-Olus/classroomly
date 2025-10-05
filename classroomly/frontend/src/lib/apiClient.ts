/**
 * API Client for communicating with the backend
 * This replaces direct Supabase calls in the frontend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

class ApiClient {
  private baseURL: string;
  private authToken: string | null = null;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
    this.authToken = this.getStoredToken();
  }

  private getStoredToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('authToken');
    }
    return null;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  setAuthToken(token: string) {
    this.authToken = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('authToken', token);
    }
  }

  clearAuthToken() {
    this.authToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await this.request<{
      success: boolean;
      message: string;
      data: any;
      token: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.success && response.token) {
      this.setAuthToken(response.token);
    }

    return response;
  }

  async register(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    userType: 'TUTOR' | 'STUDENT';
    hourlyRate?: number;
    subjects?: string[];
  }) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async logout() {
    this.clearAuthToken();
    // Optionally call backend logout endpoint if it exists
  }

  // User endpoints
  async getProfile() {
    return this.request('/api/profile');
  }

  async updateProfile(profileData: any) {
    return this.request('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  // Class endpoints
  async getClasses(params?: {
    subject?: string;
    level?: string;
    tutorId?: string;
    page?: number;
    limit?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const queryString = searchParams.toString();
    const endpoint = `/api/classes${queryString ? `?${queryString}` : ''}`;
    
    return this.request(endpoint);
  }

  async getClass(id: string) {
    return this.request(`/api/classes/${id}`);
  }

  async createClass(classData: {
    title: string;
    description?: string;
    subject: string;
    level?: string;
    maxStudents?: number;
    durationMinutes: number;
    pricePerSession: number;
  }) {
    return this.request('/api/classes', {
      method: 'POST',
      body: JSON.stringify(classData),
    });
  }

  async updateClass(id: string, classData: any) {
    return this.request(`/api/classes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(classData),
    });
  }

  async deleteClass(id: string) {
    return this.request(`/api/classes/${id}`, {
      method: 'DELETE',
    });
  }

  // Booking endpoints
  async getBookings(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const queryString = searchParams.toString();
    const endpoint = `/api/bookings${queryString ? `?${queryString}` : ''}`;
    
    return this.request(endpoint);
  }

  async createBooking(bookingData: {
    classId: string;
    scheduledAt: string;
    notes?: string;
  }) {
    return this.request('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData),
    });
  }

  async updateBookingStatus(id: string, status: string) {
    return this.request(`/api/bookings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async cancelBooking(id: string) {
    return this.updateBookingStatus(id, 'cancelled');
  }

  // Session endpoints
  async getSession(id: string) {
    return this.request(`/api/sessions/${id}`);
  }

  async startSession(id: string) {
    return this.request(`/api/sessions/${id}/start`, {
      method: 'POST',
    });
  }

  async endSession(id: string) {
    return this.request(`/api/sessions/${id}/end`, {
      method: 'POST',
    });
  }

  // Message endpoints
  async getMessages(sessionId: string) {
    return this.request(`/api/messages?sessionId=${sessionId}`);
  }

  async sendMessage(messageData: {
    recipientId: string;
    sessionId?: string;
    content: string;
    messageType?: 'text' | 'file' | 'image' | 'system';
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
  }) {
    return this.request('/api/messages', {
      method: 'POST',
      body: JSON.stringify(messageData),
    });
  }

  // Material endpoints
  async getMaterials(params?: {
    classId?: string;
    sessionId?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const queryString = searchParams.toString();
    const endpoint = `/api/materials${queryString ? `?${queryString}` : ''}`;
    
    return this.request(endpoint);
  }

  async uploadMaterial(materialData: {
    classId?: string;
    sessionId?: string;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    title: string;
    description?: string;
  }) {
    return this.request('/api/materials', {
      method: 'POST',
      body: JSON.stringify(materialData),
    });
  }

  // Availability endpoints
  async getAvailability(tutorId?: string) {
    const endpoint = tutorId ? `/api/availability?tutorId=${tutorId}` : '/api/availability';
    return this.request(endpoint);
  }

  async updateAvailability(availabilityData: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    timezone: string;
    bufferMinutes?: number;
  }[]) {
    return this.request('/api/availability', {
      method: 'PUT',
      body: JSON.stringify({ availability: availabilityData }),
    });
  }

  // Utility methods
  isAuthenticated(): boolean {
    return !!this.authToken;
  }

  getAuthToken(): string | null {
    return this.authToken;
  }
}

// Create and export a singleton instance
export const apiClient = new ApiClient();
export default apiClient;
