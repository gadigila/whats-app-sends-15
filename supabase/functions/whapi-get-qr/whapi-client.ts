
export class WhapiClient {
  async getQrCode(instanceId: string, channelToken: string): Promise<Response> {
    if (!channelToken) {
      throw new Error('Channel token is required for QR generation')
    }

    // Use correct WHAPI QR endpoint with channel token - loginuser endpoint
    const qrEndpoint = `https://gate.whapi.cloud/loginuser`
    
    console.log('📡 Requesting QR from WHAPI Gate API (loginuser):', qrEndpoint)
    console.log('🔑 Using instance ID:', instanceId)

    return await fetch(qrEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${channelToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // Send empty body or any required parameters
      })
    })
  }

  async getQrCodeImage(instanceId: string, channelToken: string): Promise<Response> {
    if (!channelToken) {
      throw new Error('Channel token is required for QR generation')
    }

    // Alternative endpoint for image format - loginuserimage
    const qrEndpoint = `https://gate.whapi.cloud/loginuserimage`
    
    console.log('📡 Requesting QR image from WHAPI Gate API (loginuserimage):', qrEndpoint)

    return await fetch(qrEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${channelToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // Send empty body or any required parameters
      })
    })
  }

  async getQrCodeRowData(instanceId: string, channelToken: string): Promise<Response> {
    if (!channelToken) {
      throw new Error('Channel token is required for QR generation')
    }

    // Row data endpoint - loginuserrowdata
    const qrEndpoint = `https://gate.whapi.cloud/loginuserrowdata`
    
    console.log('📡 Requesting QR row data from WHAPI Gate API (loginuserrowdata):', qrEndpoint)

    return await fetch(qrEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${channelToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // Send empty body or any required parameters
      })
    })
  }
}
