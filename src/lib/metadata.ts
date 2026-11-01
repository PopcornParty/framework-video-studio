export interface ExtractedMetadata {
  duration: number
  width: number
  height: number
  orientation: 'landscape' | 'portrait' | 'square' | 'unknown'
  resolution: string
}

export async function extractMetadata(file: File): Promise<ExtractedMetadata> {
  const empty: ExtractedMetadata = {
    duration: 0,
    width: 0,
    height: 0,
    orientation: 'unknown',
    resolution: '',
  }

  if (file.type.startsWith('image/')) {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const w = img.naturalWidth
        const h = img.naturalHeight
        URL.revokeObjectURL(url)
        resolve({
          duration: 0,
          width: w,
          height: h,
          orientation: orientationFrom(w, h),
          resolution: w && h ? `${w}x${h}` : '',
        })
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(empty)
      }
      img.src = url
    })
  }

  if (file.type.startsWith('video/')) {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      const url = URL.createObjectURL(file)
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        const w = video.videoWidth
        const h = video.videoHeight
        const dur = video.duration || 0
        URL.revokeObjectURL(url)
        resolve({
          duration: Math.round(dur * 100) / 100,
          width: w,
          height: h,
          orientation: orientationFrom(w, h),
          resolution: w && h ? `${w}x${h}` : '',
        })
      }
      video.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(empty)
      }
      video.src = url
    })
  }

  return empty
}

function orientationFrom(w: number, h: number): ExtractedMetadata['orientation'] {
  if (!w || !h) return 'unknown'
  const ratio = w / h
  if (Math.abs(ratio - 1) < 0.05) return 'square'
  return ratio > 1 ? 'landscape' : 'portrait'
}
