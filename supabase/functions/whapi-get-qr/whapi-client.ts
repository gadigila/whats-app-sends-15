
export class WhapiClient {
  async getQrCode(instanceId: string): Promise<Response> {
    const partnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')
    if (!partnerToken) {
      throw new Error('WHAPI_PARTNER_TOKEN not configured')
    }

    // Use Manager API endpoint with partner token
    const qrEndpoint = `https://manager.whapi.cloud/channels/${instanceId}/qr`
    
    console.log('📡 Requesting QR from Manager API:', qrEndpoint)

    return await fetch(qrEndpoint, {
      headers: {
        'Authorization': `Bearer ${partnerToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
  }

  async getQrCodeFallback(instanceId: string, channelToken: string): Promise<Response> {
    // Fallback to Gate API if Manager API fails
    const qrEndpoint = `https://gate.whapi.cloud/channels/${instanceId}/qr`
    
    console.log('📡 Fallback: Requesting QR from Gate API:', qrEndpoint)

    return await fetch(qrEndpoint, {
      headers: {
        'Authorization': `Bearer ${channelToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
  }
}
