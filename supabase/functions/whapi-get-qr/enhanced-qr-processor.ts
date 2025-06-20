
export class EnhancedQRProcessor {
  private token: string;
  private maxRetries: number = 5; // Increased retries
  private baseDelay: number = 2000; // 2 seconds base delay
  private maxDelay: number = 10000; // 10 seconds max delay

  constructor(token: string) {
    this.token = token;
  }

  async getQRWithRetry(): Promise<{
    success: boolean;
    qr_code?: string;
    already_connected?: boolean;
    message?: string;
    status?: string;
    retry_after?: number;
  }> {
    console.log('🔄 Enhanced QR processor starting with improved retry logic...');
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      console.log(`🎯 QR attempt ${attempt}/${this.maxRetries}`);
      
      try {
        // First, check channel health
        const healthResult = await this.checkChannelHealth();
        console.log('📊 Health check result:', healthResult);
        
        if (healthResult.already_connected) {
          return {
            success: true,
            already_connected: true,
            message: 'WhatsApp is already connected',
            status: 'connected'
          };
        }
        
        if (healthResult.status === 'initializing') {
          console.log('⏳ Channel still initializing, will retry...');
          const retryDelay = Math.min(this.baseDelay * Math.pow(1.5, attempt - 1), this.maxDelay);
          
          if (attempt < this.maxRetries) {
            return {
              success: false,
              message: `Channel is still initializing. Retrying in ${Math.round(retryDelay / 1000)} seconds...`,
              status: 'initializing',
              retry_after: retryDelay
            };
          }
        }
        
        // Try to get QR code
        const qrResult = await this.getQRCode();
        if (qrResult.success) {
          return qrResult;
        }
        
        // If not successful, wait before next attempt
        if (attempt < this.maxRetries) {
          const delay = Math.min(this.baseDelay * Math.pow(1.5, attempt - 1), this.maxDelay);
          console.log(`⏳ Waiting ${delay}ms before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        console.error(`❌ QR attempt ${attempt} failed:`, error);
        
        if (attempt === this.maxRetries) {
          return {
            success: false,
            message: `Failed to get QR code after ${this.maxRetries} attempts: ${error.message}`,
            status: 'error'
          };
        }
        
        // Exponential backoff for errors
        const delay = Math.min(this.baseDelay * Math.pow(2, attempt - 1), this.maxDelay);
        console.log(`⏳ Error backoff: waiting ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return {
      success: false,
      message: `Channel may still be initializing. Max retries (${this.maxRetries}) reached.`,
      status: 'timeout'
    };
  }

  private async checkChannelHealth(): Promise<{
    already_connected: boolean;
    status: string;
  }> {
    try {
      console.log('🏥 Checking channel health...');
      
      // Check health endpoint
      const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📊 Health response status:', healthResponse.status);
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        console.log('📊 Health data:', healthData);
        
        // Check if already connected via /me endpoint as fallback
        try {
          const meResponse = await fetch(`https://gate.whapi.cloud/me`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (meResponse.ok) {
            const meData = await meResponse.json();
            console.log('👤 Me data:', meData);
            
            if (meData.phone) {
              return {
                already_connected: true,
                status: 'connected'
              };
            }
          }
        } catch (meError) {
          console.log('⚠️ /me check failed:', meError.message);
        }
        
        return {
          already_connected: false,
          status: healthData.status || 'unknown'
        };
      }
      
      return {
        already_connected: false,
        status: 'initializing'
      };
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return {
        already_connected: false,
        status: 'error'
      };
    }
  }

  private async getQRCode(): Promise<{
    success: boolean;
    qr_code?: string;
    message?: string;
    status?: string;
  }> {
    try {
      console.log('📱 Attempting to get QR code...');
      
      const qrResponse = await fetch(`https://gate.whapi.cloud/qr`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📱 QR response status:', qrResponse.status);
      
      if (!qrResponse.ok) {
        const errorText = await qrResponse.text();
        console.error('❌ QR request failed:', errorText);
        
        // Parse error for better handling
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        
        return {
          success: false,
          message: errorData.message || `QR request failed with status ${qrResponse.status}`,
          status: 'error'
        };
      }
      
      const qrData = await qrResponse.json();
      console.log('📱 QR data received:', { hasQR: !!qrData.qr });
      
      if (qrData.qr) {
        return {
          success: true,
          qr_code: qrData.qr,
          message: 'QR code generated successfully',
          status: 'qr_ready'
        };
      }
      
      return {
        success: false,
        message: 'No QR code in response',
        status: 'no_qr'
      };
      
    } catch (error) {
      console.error('❌ QR code generation failed:', error);
      return {
        success: false,
        message: `QR generation error: ${error.message}`,
        status: 'error'
      };
    }
  }
}
