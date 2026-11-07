import { Toast } from '@heroui/react'

// Abajo al centro y no a la derecha: ahí vive el botón flotante de creación,
// y un aviso encima lo tapa justo cuando se acaba de usar.
function Toaster() {
  return <Toast.Provider placement="bottom" />
}

export { Toaster }
