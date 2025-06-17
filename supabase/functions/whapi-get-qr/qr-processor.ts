
export class QrProcessor {
  processQrResponse(qrData: any): any {
    console.log('🔄 Processing QR response:', Object.keys(qrData))
    
    if (qrData.qr) {
      console.log('✅ QR code found in response')
      // Handle base64 QR code
      let qrCode = qrData.qr
      if (!qrCode.startsWith('data:image/')) {
        qrCode = `data:image/png;base64,${qrCode}`
      }
      
      return {
        success: true,
        qr_code: qrCode,
        message: 'QR code generated successfully'
      }
    } else if (qrData.qrCode) {
      console.log('✅ QR code found in qrCode field')
      let qrCode = qrData.qrCode
      if (!qrCode.startsWith('data:image/')) {
        qrCode = `data:image/png;base64,${qrCode}`
      }
      
      return {
        success: true,
        qr_code: qrCode,
        message: 'QR code generated successfully'
      }
    } else if (qrData.image) {
      console.log('✅ QR code found in image field')
      let qrCode = qrData.image
      if (!qrCode.startsWith('data:image/')) {
        qrCode = `data:image/png;base64,${qrCode}`
      }
      
      return {
        success: true,
        qr_code: qrCode,
        message: 'QR code generated successfully'
      }
    } else if (qrData.data && qrData.data.qr) {
      console.log('✅ QR code found in data.qr field')
      let qrCode = qrData.data.qr
      if (!qrCode.startsWith('data:image/')) {
        qrCode = `data:image/png;base64,${qrCode}`
      }
      
      return {
        success: true,
        qr_code: qrCode,
        message: 'QR code generated successfully'
      }
    } else {
      console.log('⚠️ No QR code found in response, checking for success status')
      
      // Check if it's a success response without QR (maybe already connected)
      if (qrData.success === true || qrData.status === 'success') {
        return {
          success: false,
          error: 'Channel may already be connected or QR not available',
          requiresNewInstance: false,
          retryable: true
        }
      }
      
      console.error('❌ No QR code found in response:', qrData)
      return {
        success: false,
        error: 'QR code not found in response',
        details: qrData,
        retryable: true
      }
    }
  }

  createErrorResponse(status: number, errorText: string, instanceId: string): any {
    console.error('❌ Creating error response:', { status, errorText, instanceId })
    
    // Determine if error is retryable
    const retryable = status >= 500 || status === 429 || status === 502 || status === 503 || status === 504
    
    // Determine if new instance is required
    const requiresNewInstance = status === 404 || errorText.includes('not found') || errorText.includes('does not exist')
    
    return {
      success: false,
      error: `WHAPI request failed: ${status}`,
      details: {
        status,
        error: errorText,
        instanceId
      },
      retryable,
      requiresNewInstance
    }
  }

  createNetworkErrorResponse(error: any): any {
    console.error('❌ Creating network error response:', error)
    
    return {
      success: false,
      error: 'Network error occurred',
      details: error.message || 'Unknown network error',
      retryable: true,
      requiresNewInstance: false
    }
  }

  createMissingInstanceResponse(): any {
    console.log('🚨 Creating missing instance response')
    
    return {
      success: false,
      error: 'No instance or token found',
      message: 'Please create a new instance first',
      requiresNewInstance: true,
      retryable: false
    }
  }
}
