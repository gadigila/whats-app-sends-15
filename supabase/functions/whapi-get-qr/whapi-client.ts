
export class WhapiClient {
  async getQrCode(instanceId: string, channelToken: string): Promise<Response> {
    if (!channelToken) {
      throw new Error('Channel token is required for QR generation')
    }

    // Use correct WHAPI QR endpoint according to documentation
    const qrEndpoint = `https://gate.whapi.cloud/instance/qr?id=${instanceId}`
    
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
}
