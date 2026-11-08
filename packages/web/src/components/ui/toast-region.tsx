import { Toast } from '@heroui/react'

// Arriba al centro: abajo vive el grupo de altas flotante (`PageLayout`), y un aviso
// encima lo tapa justo cuando se acaba de usar.
function Toaster() {
  return <Toast.Provider placement="top" />
}

export { Toaster }
