
interface QRResult {
  success: boolean;
  qr_code?: string;
  already_connected?: boolean;
  message: string;
  status?: string;
  retry_after?: number;
}

export class EnhancedQRProcessor {
  private token: string;
  private maxRetries: number = 5;
  private baseDelayMs: number = 2000;

  constructor(token: string) {
    this.token = token;
  }

  async getQRWithRetry(): Promise<QRResult> {
    console.log('🔄 Starting enhanced QR retrieval process...');
    
    // First, check current status
    const statusResult = await this.checkChannelStatus();
    if (!statusResult.success) {
      return statusResult;
    }

    // If already connected, return immediately
    if (statusResult.already_connected) {
      return statusResult;
    }

    // If channel is still initializing, wait and retry
    if (statusResult.status === 'initializing') {
      console.log('⏳ Channel is still initializing, implementing retry logic...');
      return await this.retryQRGeneration();
    }

    // If ready for QR, get it immediately
    if (statusResult.status === 'unauthorized' || statusResult.status === 'qr') {
      return await this.fetchQRCode();
    }

    return {
      success: false,
      message: `Channel status ${statusResult.status} is not ready for QR generation`
    };
  }

  private async checkChannelStatus(): Promise<QRResult> {
    try {
      console.log('📊 Checking channel status...');
      
      const statusResponse = await fetch('https://gate.whapi.cloud/status', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!statusResponse.ok) {
        console.error('❌ Status check failed:', statusResponse.status);
        
        if (statusResponse.status === 404) {
          return {
            success: false,
            message: 'Channel not found - may still be initializing',
            status: 'initializing',
            retry_after: 3000
          };
        }
        
        return {
          success: false,
          message: 'Failed to check channel status'
        };
      }

      const statusData = await statusResponse.json();
      console.log('📊 Channel status:', statusData);

      // Check if already connected
      if (statusData.status === 'connected' || statusData.status === 'authenticated') {
        console.log('✅ Channel is already connected');
        return {
          success: true,
          already_connected: true,
          message: 'WhatsApp is already connected',
          status: statusData.status
        };
      }

      return {
        success: true,
        message: 'Status check successful',
        status: statusData.status
      };

    } catch (error) {
      console.error('❌ Error checking status:', error);
      return {
        success: false,
        message: 'Network error checking channel status'
      };
    }
  }

  private async retryQRGeneration(): Promise<QRResult> {
    console.log('🔄 Starting QR generation retry loop...');
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      console.log(`📱 QR generation attempt ${attempt}/${this.maxRetries}...`);
      
      // Progressive delay: 2s, 3s, 4s, 5s, 6s
      const delayMs = this.baseDelayMs + (attempt * 1000);
      console.log(`⏳ Waiting ${delayMs}ms before attempt...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
      // Check status again
      const statusResult = await this.checkChannelStatus();
      
      if (statusResult.already_connected) {
        return statusResult;
      }
      
      if (statusResult.status === 'unauthorized' || statusResult.status === 'qr') {
        console.log('🎉 Channel is now ready for QR!');
        return await this.fetchQRCode();
      }
      
      if (statusResult.status === 'error' || statusResult.status === 'failed') {
        return {
          success: false,
          message: 'Channel failed to initialize properly'
        };
      }
      
      console.log(`⏳ Channel still in ${statusResult.status} state, retrying...`);
    }
    
    return {
      success: false,
      message: 'Channel initialization timeout - please try refreshing or creating a new connection',
      retry_after: 10000
    };
  }

  private async fetchQRCode(): Promise<QRResult> {
    try {
      console.log('📱 Fetching QR code...');
      
      const qrResponse = await fetch('https://gate.whapi.cloud/screen', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!qrResponse.ok) {
        const errorText = await qrResponse.text();
        console.error('❌ QR fetch failed:', errorText);
        
        if (qrResponse.status === 404) {
          return {
            success: false,
            message: 'QR code not available yet - channel may still be initializing',
            retry_after: 3000
          };
        }
        
        return {
          success: false,
          message: `Failed to get QR code: ${errorText}`
        };
      }

      const qrData = await qrResponse.json();
      console.log('📱 QR data received:', { hasQR: !!(qrData?.qr || qrData?.qr_code) });

      const qrCode = qrData?.qr || qrData?.qr_code;
      
      if (!qrCode) {
        return {
          success: false,
          message: 'QR code not available in response'
        };
      }

      return {
        success: true,
        qr_code: qrCode,
        message: 'QR code retrieved successfully'
      };

    } catch (error) {
      console.error('❌ Error fetching QR:', error);
      return {
        success: false,
        message: 'Network error fetching QR code'
      };
    }
  }
}
