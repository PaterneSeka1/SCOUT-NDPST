'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { encoderQrScout } from '@/lib/qr'

interface QRCodeScoutProps {
  scoutId: string
  taille?: number
}

export function QRCodeScout({ scoutId, taille = 160 }: QRCodeScoutProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, encoderQrScout(scoutId), {
      width: taille,
      margin: 1,
      color: { dark: '#1a4731', light: '#ffffff' },
    })
  }, [scoutId, taille])

  return <canvas ref={canvasRef} width={taille} height={taille} />
}
