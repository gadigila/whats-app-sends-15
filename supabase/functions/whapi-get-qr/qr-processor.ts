
import type { QrResponse } from './types.ts'

export class QrProcessor {
  processQrResponse(qrData: any): QrResponse {
    console.log('✅ QR data received:', Object.keys(qrData))
    
    // Handle different possible response formats from Partner API
    let qrCodeUrl = null
    if (qrData.qr_code) {
      qrCodeUrl = qrData.qr_code.startsWith('data:') ? qrData.qr_code : `data:image/png;base64,${qrData.qr_code}`
    } else if (qrData.qr) {
      qrCodeUrl = qrData.qr.startsWith('data:') ? qrData.qr : `data:image/png;base64,${qrData.qr}`
    } else if (qrData.image) {
      qrCodeUrl = qrData.image.startsWith('data:') ? qrData.image : `data:image/png;base64,${qrData.image}`
    } else if (qrData.data && qrData.data.qr_code) {
      qrCodeUrl = qrData.data.qr_code.startsWith('data:') ? qrData.data.qr_code : `data:image/png;base64,${qrData.data.qr_code}`
    }
    
    if (qrCodeUrl) {
      console.log('✅ QR code processed successfully')
      return {
        success: true,
        qr_code: qrCodeUrl,
        message: 'QR code retrieved successfully'
      }
    } else {
      console.error('⚠️ No QR code found in Partner API response:', qrData)
      return {
        success: false,
        error: 'No QR code in Partner API response',
        details: { responseKeys: Object.keys(qrData), response: qrData }
      }
    }
  }

  createErrorResponse(status: number, errorText: string, endpoint: string): QrResponse {
    return {
      success: false,
      error: 'Failed to get QR code from Partner API',
      details: { status, error: errorText, endpoint }
    }
  }

  createNetworkErrorResponse(error: Error): QrResponse {
    return {
      success: false,
      error: 'Network error connecting to Partner API',
      details: error.message
    }
  }

  createMissingInstanceResponse(): QrResponse {
    return {
      success: false,
      error: 'WhatsApp instance not found',
      requiresNewInstance: true
    }
  }
}
