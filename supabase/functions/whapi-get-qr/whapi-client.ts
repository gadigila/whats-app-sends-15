export class WhapiClient {
  async getQrCode(instanceId: string, channelToken: string): Promise<Response> {
    if (!channelToken) {
      throw new Error('Channel token is required for QR generation')
    }

    // ✅ CORRECT ENDPOINT:
    const qrEndpoint = `https://gate.whapi.cloud/users/login`
    
    console.log('📡 Requesting QR from WHAPI Gate API:', qrEndpoint)
    console.log('🔑 Using channel token for authentication')

    return await fetch(qrEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${channelToken}`,
        'Accept': 'application/json'
      }
    })
  }
}