'use client'

import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

interface ScannerQRProps {
  onDetection: (contenu: string) => void
  onFermer: () => void
}

// Scanner de QR code par caméra, sans dépendance native : capture le flux
// vidéo, dessine chaque frame sur un canvas caché et fait décoder le buffer
// de pixels par jsQR. Fonctionne dans n'importe quel navigateur avec accès
// caméra (pas besoin de l'API BarcodeDetector, non supportée partout).
export function ScannerQR({ onDetection, onFermer }: ScannerQRProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [erreur, setErreur] = useState('')
  const dernierScanRef = useRef<{ contenu: string; horodatage: number } | null>(null)

  useEffect(() => {
    let flux: MediaStream | null = null
    let animationId: number
    let arrete = false

    async function demarrer() {
      try {
        flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (arrete) { flux.getTracks().forEach((t) => t.stop()); return }
        if (videoRef.current) {
          videoRef.current.srcObject = flux
          await videoRef.current.play()
        }
        analyser()
      } catch {
        setErreur("Impossible d'accéder à la caméra. Vérifiez les autorisations du navigateur.")
      }
    }

    function analyser() {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || arrete) return

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(image.data, image.width, image.height)
          if (code?.data) {
            const maintenant = Date.now()
            const dernier = dernierScanRef.current
            // Anti-doublon : ignore un même contenu scanné à moins de 2 secondes
            // d'intervalle (la caméra continue de voir le même badge).
            if (!dernier || dernier.contenu !== code.data || maintenant - dernier.horodatage > 2000) {
              dernierScanRef.current = { contenu: code.data, horodatage: maintenant }
              onDetection(code.data)
            }
          }
        }
      }
      animationId = requestAnimationFrame(analyser)
    }

    demarrer()

    return () => {
      arrete = true
      cancelAnimationFrame(animationId)
      flux?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-3">
        <div className="relative bg-black rounded-xl overflow-hidden aspect-square">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute inset-8 border-2 border-white/70 rounded-lg pointer-events-none" />
        </div>
        {erreur && <p className="text-sm text-red-300 text-center">{erreur}</p>}
        <p className="text-sm text-white/70 text-center">Visez le QR code de la carte du scout</p>
        <button
          onClick={onFermer}
          className="w-full bg-white/10 text-white py-2.5 rounded-lg hover:bg-white/20 transition-colors text-sm font-medium"
        >
          Fermer le scanner
        </button>
      </div>
    </div>
  )
}
