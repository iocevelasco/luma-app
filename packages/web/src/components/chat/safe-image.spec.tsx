import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stubObjectUrls } from '@/test/chat-fixtures';
import { createLocalPreview } from '@/lib/chat/urls';
import { ImageViewer, SafeImage } from './safe-image';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, o?: { name?: string }) => (o?.name ? `${key}:${o.name}` : key) }),
}));

beforeEach(() => {
  stubObjectUrls();
});

describe('miniatura y visor comparten las mismas restricciones', () => {
  it('una vista previa creada por la app se ve en la miniatura y en el visor, con los mismos atributos', async () => {
    const url = createLocalPreview(new Blob(['x']));
    render(<SafeImage src={url} kind="local-preview" alt="foto.png" zoomable />);

    const thumb = screen.getByRole('img', { name: 'foto.png' });
    expect(thumb).toHaveAttribute('src', url);

    await userEvent.click(screen.getByRole('button', { name: 'secureChat.openImage:foto.png' }));
    const viewer = await screen.findByTestId('image-viewer');
    const big = viewer.querySelector('img')!;
    expect(big).toHaveAttribute('src', url);
    for (const attr of ['referrerpolicy', 'loading', 'decoding']) {
      expect(big.getAttribute(attr)).toBe(thumb.getAttribute(attr));
    }
  });

  it('un blob forjado se bloquea en la miniatura, sin botón para ampliarla', () => {
    render(<SafeImage src="blob:https://luma.test/forjada" kind="local-preview" alt="x.png" zoomable />);
    expect(screen.getByTestId('blocked-image')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });

  it('el visor vuelve a validar: no abre una URL que la miniatura no habría mostrado', async () => {
    const { rerender } = render(<ImageViewer open onOpenChange={() => {}} src="blob:https://luma.test/forjada" kind="local-preview" alt="x.png" />);
    const viewer = await screen.findByTestId('image-viewer');
    expect(viewer.querySelector('img')).toBeNull();
    expect(viewer.querySelector('[data-testid="blocked-image"]')).not.toBeNull();

    rerender(<ImageViewer open onOpenChange={() => {}} src="javascript:alert(1)" kind="remote-image" alt="x.png" />);
    expect(screen.getByTestId('image-viewer').querySelector('img')).toBeNull();
  });

  it('un origen remoto no autorizado se bloquea en ambos', async () => {
    render(<SafeImage src="https://tracker.example.net/p.png" kind="remote-image" alt="p" zoomable />);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText(/secureChat.blockedImage/)).toBeInTheDocument();
  });

  it('si la imagen no carga, queda un estado comprensible', () => {
    const url = createLocalPreview(new Blob(['x']));
    render(<SafeImage src={url} kind="local-preview" alt="rota.png" />);
    screen.getByRole('img', { name: 'rota.png' }).dispatchEvent(new Event('error'));
    return screen.findByTestId('blocked-image');
  });
});
