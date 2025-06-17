
// WHAPI Service - Direct API communication layer
export class WHAPIService {
  private apiKey: string;
  private baseURL = 'https://gate.whapi.cloud';
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // Headers for all requests
  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  // Check connection and get instances
  async checkConnection() {
    try {
      const response = await fetch(`${this.baseURL}/settings`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Connection failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        settings: data,
        message: 'Connection successful to WHAPI'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to connect to WHAPI'
      };
    }
  }

  // Get QR code for instance
  async getQRCode(instanceId: string) {
    try {
      const response = await fetch(`${this.baseURL}/instance/qr?id=${instanceId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get QR code: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return {
        success: true,
        qrCode: data.qr_code || data.qr,
        message: 'QR Code received successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Error getting QR Code'
      };
    }
  }

  // Check instance status
  async getInstanceStatus(instanceId: string) {
    try {
      const response = await fetch(`${this.baseURL}/channels/${instanceId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            error: 'Instance not found',
            requiresCleanup: true,
            message: 'Instance not found on WHAPI'
          };
        }
        throw new Error(`Failed to get status: ${response.status}`);
      }

      const data = await response.json();
      const isConnected = data.status === 'active' || !!data.phone;
      
      return {
        success: true,
        status: data.status,
        phone: data.phone || null,
        connected: isConnected,
        message: 'Status retrieved successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Error getting instance status'
      };
    }
  }

  // Send message to specific contact/group
  async sendMessage(instanceId: string, to: string, message: string) {
    try {
      const payload = {
        to: to,
        body: message,
        typing_time: 0
      };

      const response = await fetch(`${this.baseURL}/messages/text`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to send message: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        messageId: data.id || data.message_id,
        message: 'Message sent successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Error sending message'
      };
    }
  }

  // Get groups list
  async getGroups(instanceId: string) {
    try {
      const response = await fetch(`${this.baseURL}/groups`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to get groups: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        groups: data.groups || data.chats || [],
        message: 'Groups retrieved successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Error getting groups'
      };
    }
  }
}
