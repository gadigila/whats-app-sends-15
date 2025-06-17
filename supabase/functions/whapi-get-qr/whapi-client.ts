
export class WhapiClient {
  async getQrCode(instanceId: string, token: string): Promise<Response> {
    const qrEndpoint = `https://partner-api.whapi.cloud/api/v1/channels/${instanceId}/qr`
    
    console.log('📡 Requesting QR from Partner API:', qrEndpoint)

    return await fetch(qrEndpoint, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
  }
}
