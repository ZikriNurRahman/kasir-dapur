import { differenceInMinutes } from 'date-fns'

// Format angka ke Rupiah — e.g., 25000 → "Rp 25.000"
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0
  }).format(amount)
}

// Hitung berapa menit sejak order dibuat
export function getOrderAge(createdAt: string): number {
  return differenceInMinutes(new Date(), new Date(createdAt))
}

// Tentukan warna card KDS berdasarkan umur order
// Hijau <10 mnt · Kuning 10-20 mnt · Merah >20 mnt + berkedip
export function getTimerStyle(createdAt: string) {
  const mins = getOrderAge(createdAt)
  if (mins < 10) return {
    bg: 'bg-green-950', border: 'border-green-500',
    text: 'text-green-400', blink: false, label: `${mins}m`
  }
  if (mins < 20) return {
    bg: 'bg-yellow-950', border: 'border-yellow-500',
    text: 'text-yellow-400', blink: false, label: `${mins}m`
  }
  return {
    bg: 'bg-red-950', border: 'border-red-500',
    text: 'text-red-400', blink: true, label: `${mins}m ⚠️`
  }
}

// Format jam order untuk tampilan di KDS — e.g., "14:35"
export function formatTime(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit'
  })
}

// Helper gabung class names Tailwind (tanpa install clsx)
export function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}
