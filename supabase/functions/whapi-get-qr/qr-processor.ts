
export class QrProcessor {
  processQrResponse(qrData: any): any {
    console.log('🔄 Processing QR response with enhanced detection...')
    console.log('📥 Raw response structure:', {
      keys: Object.keys(qrData),
      hasQr: 'qr' in qrData,
      hasQrCode: 'qrCode' in qrData,
      hasImage: 'image' in qrData,
      hasType: 'type' in qrData,
      hasMessage: 'message' in qrData,
      hasData: 'data' in qrData,
      dataType: qrData.data ? typeof qrData.data : 'undefined'
    })
    
    // ENHANCED: Handle WHAPI's QR response format - /screenshot returns 'image' field
    
    // Format 1: WHAPI /screenshot endpoint - returns image field (CORRECT FORMAT)
    if (qrData.image) {
      console.log('✅ QR code found in image field (WHAPI screenshot format)')
      let qrCode = qrData.image
      
      // Ensure proper base64 formatting
      if (!qrCode.startsWith('data:image/')) {
        qrCode = `data:image/png;base64,${qrCode}`
      }
      
      return {
        success: true,
        qr_code: qrCode,
        message: 'QR code generated successfully'
      }
    }
    
    // Format 2: Legacy direct QR fields (for backward compatibility)
    else if (qrData.qr || qrData.qrCode) {
      const qrCode = qrData.qr || qrData.qrCode
      console.log('✅ QR code found in legacy qr/qrCode field')
      
      // Ensure proper base64 formatting
      let formattedQrCode = qrCode
      if (!formattedQrCode.startsWith('data:image/')) {
        formattedQrCode = `data:image/png;base64,${qrCode}`
      }
      
      return {
        success: true,
        qr_code: formattedQrCode,
        message: 'QR code generated successfully'
      }
    }
    
    // Format 3: Nested in data object
    else if (qrData.data && (qrData.data.qr || qrData.data.image)) {
      console.log('✅ QR code found in data object')
      let qrCode = qrData.data.qr || qrData.data.image
      if (!qrCode.startsWith('data:image/')) {
        qrCode = `data:image/png;base64,${qrCode}`
      }
      
      return {
        success: true,
        qr_code: qrCode,
        message: 'QR code generated successfully'
      }
    }
    
    // Format 4: WHAPI type/message format
    else if (qrData.type === 'qrCode' && qrData.message) {
      console.log('✅ QR code found in type/message format')
      let qrCode = qrData.message
      if (!qrCode.startsWith('data:image/')) {
        qrCode = `data:image/png;base64,${qrCode}`
      }
      
      return {
        success: true,
        qr_code: qrCode,
        message: 'QR code generated successfully'
      }
    }
    
    // Format 5: Check for success status without QR (maybe already connected)
    else if (qrData.success === true || qrData.status === 'success') {
      console.log('⚠️ Success response without QR - possibly already connected')
      return {
        success: false,
        error: 'Channel may already be connected or QR not available',
        requiresNewInstance: false,
        retryable: true
      }
    }
    
    // Format 6: Error responses
    else if (qrData.error || qrData.errors) {
      const errorMessage = qrData.error || (qrData.errors && qrData.errors[0] ? qrData.errors[0].message : 'Unknown error')
      console.error('❌ Error in QR response:', errorMessage)
      return {
        success: false,
        error: errorMessage,
        details: qrData,
        retryable: true
      }
    }
    
    // Format 7: Unknown format
    else {
      console.error('❌ No QR code found in response. Unknown format:', qrData)
      return {
        success: false,
        error: 'QR code not found in response',
        details: {
          responseKeys: Object.keys(qrData),
          fullResponse: qrData
        },
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
