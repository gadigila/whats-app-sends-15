
export class WhapiClient {
  async getQrCode(instanceId: string, channelToken: string): Promise<Response> {
    if (!channelToken) {
      throw new Error('Channel token is required for QR generation')
    }

    // Use correct WHAPI QR endpoint with channel token
    const qrEndpoint = `https://gate.whapi.cloud/login`
    
    console.log('📡 Requesting QR from WHAPI Gate API:', qrEndpoint)

    return await fetch(qrEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${channelToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // Add any required parameters for QR generation
      })
    })
  }

  // Remove the fallback method since we're using the correct endpoint now
  async getQrCodeImage(instanceId: string, channelToken: string): Promise<Response> {
    if (!channelToken) {
      throw new Error('Channel token is required for QR generation')
    }

    // Alternative endpoint for image format
    const qrEndpoint = `https://gate.whapi.cloud/login/image`
    
    console.log('📡 Requesting QR image from WHAPI Gate API:', qrEndpoint)

    return await fetch(qrEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${channelToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // Add any required parameters for QR generation
      })
    })
  }
}
