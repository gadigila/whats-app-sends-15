
export class WhapiClient {
  private baseURL = 'https://gate.whapi.cloud'

  async getQrCode(instanceId: string, channelToken: string): Promise<Response> {
    if (!channelToken) {
      throw new Error('Channel token is required for QR generation')
    }

    // Use the correct WHAPI QR endpoint
    const qrEndpoint = `${this.baseURL}/instance/qr?id=${instanceId}`
    
    console.log('📡 Requesting QR from WHAPI Gate API:', qrEndpoint)
    console.log('🔑 Using instance ID:', instanceId)

    return await fetch(qrEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${channelToken}`,
        'Accept': 'application/json'
      }
    })
  }

  async checkChannelStatus(instanceId: string, channelToken: string): Promise<Response> {
    const statusEndpoint = `${this.baseURL}/channels/${instanceId}`
    
    return await fetch(statusEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${channelToken}`,
        'Accept': 'application/json'
      }
    })
  }

  async verifyChannelAccessibility(channelToken: string): Promise<Response> {
    const settingsEndpoint = `${this.baseURL}/settings`
    
    return await fetch(settingsEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${channelToken}`,
        'Accept': 'application/json'
      }
    })
  }
}
