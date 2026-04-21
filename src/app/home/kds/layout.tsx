// src/app/home/kds/layout.tsx
// UPDATE: path pindah ke /home/kds
// Layout KDS tetap fullscreen — HomeLayout sudah handle pengecualian ini
// (lihat home/layout.tsx — kalau pathname /home/kds, header disembunyikan)

export default function KDSLayout({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 overflow-hidden">{children}</div>
}