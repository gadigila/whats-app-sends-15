
export class WhapiClient {
  async getQrCode(instanceId: string, channelToken: string): Promise<Response> {
    if (!channelToken) {
      throw new Error('Channel token is required for QR generation')
    }

    // FIX: Use the correct WHAPI endpoint for QR code
    const qrEndpoint = `https://gate.whapi.cloud/qr`
    
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
