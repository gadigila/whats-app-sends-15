
export class ChannelManager {
  private partnerToken: string;
  
  constructor(partnerToken: string) {
    this.partnerToken = partnerToken;
  }

  async waitForChannelReady(channelId: string, maxAttempts = 10): Promise<boolean> {
    console.log(`⏳ Waiting for channel ${channelId} to be ready...`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`🔍 Checking channel status (attempt ${attempt}/${maxAttempts})`);
      
      try {
        const channelInfo = await this.getChannelInfo(channelId);
        
        if (channelInfo.success && channelInfo.status) {
          console.log(`📊 Channel status: ${channelInfo.status}`);
          
          // Check if channel is ready for Gate API calls
          if (channelInfo.status === 'LAUNCHED' || channelInfo.status === 'READY' || channelInfo.status === 'AUTHORIZED') {
            console.log(`✅ Channel is ready!`);
            return true;
          }
          
          if (channelInfo.status === 'FAILED' || channelInfo.status === 'ERROR') {
            console.error(`❌ Channel failed to launch: ${channelInfo.status}`);
            return false;
          }
        }
        
        // Wait before next attempt (exponential backoff)
        const delayMs = Math.min(2000 * Math.pow(1.5, attempt - 1), 15000);
        console.log(`⏳ Waiting ${delayMs}ms before next check...`);
        await this.delay(delayMs);
        
      } catch (error) {
        console.error(`❌ Error checking channel status (attempt ${attempt}):`, error);
        
        if (attempt === maxAttempts) {
          return false;
        }
        
        await this.delay(3000);
      }
    }
    
    console.error(`❌ Channel ${channelId} not ready after ${maxAttempts} attempts`);
    return false;
  }

  async getChannelInfo(channelId: string): Promise<any> {
    try {
      console.log(`🔍 Getting channel info for: ${channelId}`);
      
      const response = await fetch(`https://manager.whapi.cloud/channels/${channelId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.partnerToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`📥 Manager API response status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Channel info:`, {
          id: data.id,
          status: data.status,
          name: data.name,
          hasToken: !!data.token
        });
        
        return {
          success: true,
          status: data.status,
          data: data
        };
      } else {
        const errorText = await response.text();
        console.error(`❌ Manager API error: ${response.status} - ${errorText}`);
        
        return {
          success: false,
          status: response.status,
          error: errorText
        };
      }
    } catch (error) {
      console.error(`💥 Network error getting channel info:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
