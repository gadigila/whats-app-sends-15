
export class WhapiClient {
  async getQrCode(instanceId: string, channelToken: string): Promise<Response> {
    if (!channelToken) {
      throw new Error('Channel token is required for QR generation')
    }

    // FIX: Use the correct WHAPI endpoint - just /screen without instance ID
    // The channel token contains all the necessary authentication
    const qrEndpoint = `https://gate.whapi.cloud/screen`
    
    console.log('📡 Requesting QR from WHAPI Gate API:', qrEndpoint)
    console.log('🔑 Using channel token (not instance ID in URL)')

    return await fetch(qrEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${channelToken}`,
        'Accept': 'application/json'
      }
    })
  }
}
