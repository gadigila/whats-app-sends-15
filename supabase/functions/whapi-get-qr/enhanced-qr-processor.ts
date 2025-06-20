
export class EnhancedQRProcessor {
  private token: string;
  private maxRetries: number = 3; // Reduced retries for faster failure detection
  private baseDelay: number = 2000;
  private maxDelay: number = 8000;

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
    token_invalid?: boolean;
  }> {
    console.log('🔄 Enhanced QR processor with token validation...');
    
    // First, validate the token by checking channel health
    const tokenValidation = await this.validateToken();
    if (!tokenValidation.valid) {
      console.log('❌ Token validation failed:', tokenValidation.reason);
      return {
        success: false,
        message: `טוקן לא תקין: ${tokenValidation.reason}`,
        status: 'token_invalid',
        token_invalid: true
      };
    }
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      console.log(`🎯 QR attempt ${attempt}/${this.maxRetries}`);
      
      try {
        // Check channel health first
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
          console.log('⏳ Channel still initializing...');
          if (attempt < this.maxRetries) {
            const retryDelay = Math.min(this.baseDelay * attempt, this.maxDelay);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          } else {
            return {
              success: false,
              message: 'הערוץ לא מוכן. נסה ליצור ערוץ חדש',
              status: 'timeout'
            };
          }
        }
        
        // Try to get QR code
        const qrResult = await this.getQRCode();
        if (qrResult.success) {
          return qrResult;
        }
        
        // If QR failed due to token issues, mark as invalid
        if (qrResult.status === 'token_error') {
          return {
            success: false,
            message: 'הטוקן לא תקין. יוצר ערוץ חדש...',
            status: 'token_invalid',
            token_invalid: true
          };
        }
        
        // Wait before next attempt
        if (attempt < this.maxRetries) {
          const delay = Math.min(this.baseDelay * attempt, this.maxDelay);
          console.log(`⏳ Waiting ${delay}ms before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        console.error(`❌ QR attempt ${attempt} failed:`, error);
        
        if (attempt === this.maxRetries) {
          return {
            success: false,
            message: `נכשל אחרי ${this.maxRetries} ניסיונות: ${error.message}`,
            status: 'error'
          };
        }
        
        const delay = Math.min(this.baseDelay * attempt, this.maxDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return {
      success: false,
      message: `הערוץ לא מגיב. נסה ליצור ערוץ חדש`,
      status: 'timeout'
    };
  }

  private async validateToken(): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    try {
      console.log('🔑 Validating token...');
      
      // Try to call the health endpoint
      const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('🔑 Token validation response status:', healthResponse.status);
      
      if (healthResponse.status === 401 || healthResponse.status === 403) {
        return {
          valid: false,
          reason: 'Unauthorized - token is invalid or expired'
        };
      }
      
      if (healthResponse.status === 404) {
        return {
          valid: false,
          reason: 'Channel not found - may have been deleted'
        };
      }
      
      if (!healthResponse.ok) {
        const errorText = await healthResponse.text();
        console.log('🔑 Token validation error:', errorText);
        return {
          valid: false,
          reason: `HTTP ${healthResponse.status}: ${errorText}`
        };
      }
      
      console.log('✅ Token is valid');
      return { valid: true };
      
    } catch (error) {
      console.error('❌ Token validation failed:', error);
      return {
        valid: false,
        reason: `Network error: ${error.message}`
      };
    }
  }

  private async checkChannelHealth(): Promise<{
    already_connected: boolean;
    status: string;
  }> {
    try {
      console.log('🏥 Checking channel health...');
      
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
        
        // Map WHAPI status to our status
        const whapiStatus = healthData.status?.text || healthData.status;
        let mappedStatus = 'unknown';
        
        if (typeof whapiStatus === 'string') {
          switch (whapiStatus.toLowerCase()) {
            case 'qr':
            case 'ready':
            case 'unauthorized':
              mappedStatus = 'ready_for_qr';
              break;
            case 'connected':
            case 'authenticated':
              mappedStatus = 'connected';
              break;
            case 'initializing':
            case 'starting':
              mappedStatus = 'initializing';
              break;
            default:
              mappedStatus = whapiStatus.toLowerCase();
          }
        }
        
        return {
          already_connected: false,
          status: mappedStatus
        };
      }
      
      return {
        already_connected: false,
        status: 'error'
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
      
      if (qrResponse.status === 401 || qrResponse.status === 403) {
        return {
          success: false,
          message: 'Token is invalid or expired',
          status: 'token_error'
        };
      }
      
      if (!qrResponse.ok) {
        const errorText = await qrResponse.text();
        console.error('❌ QR request failed:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        
        // Check if it's a token-related error
        if (errorText.includes('unauthorized') || errorText.includes('forbidden')) {
          return {
            success: false,
            message: 'Token authorization failed',
            status: 'token_error'
          };
        }
        
        return {
          success: false,
          message: errorData.message || `QR request failed with status ${qrResponse.status}`,
          status: 'qr_error'
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
