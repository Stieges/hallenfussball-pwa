/**
 * @ZM-208 Die Adresse unter dem QR-Code der Monitor-Folie „Zuschauer-QR“ ist aus der Halle lesbar und kurz: mindestens 3 % der Bildhöhe,
 * eine Zeile, ohne „https://“ und ohne „#/“ (`host/live/CODE`). Der Start leitet diese Adresse auf die Hash-Route um (`shortLiveRedirect.test.ts`), der QR-Code
 * trägt weiter die Hash-Adresse. Die Messung am fertigen Bild (1920×1080 und 1280×720) und das Eintippen: `tests/e2e/qr-adresse-zm208.spec.ts`.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QrSlide } from '../slides/QrSlide';
import { qrTypedAddress } from '../publicVisibility';
import { displayFontSizes } from '../../../design-tokens';
import { createMockTournament } from '../../../test/factories';

vi.mock('qrcode.react', () => ({
  QRCodeSVG: (props: { value: string; title?: string }) => <div data-testid="qr-code" data-value={props.value} data-title={props.title} />,
}));

describe('@ZM-208 Adresse unter dem QR-Code', () => {
  it('die Adresse steht ohne „https://“ in einer Zeile, mindestens 3 % der Bildhöhe groß; der QR-Code trägt weiter die volle Adresse', () => {
    render(<QrSlide tournament={createMockTournament({ isPublic: true, shareCode: 'ABC123', title: 'Nikolaus-Turnier' })} style={{}} />);
    const adresse = screen.getByTestId('qr-address');
    expect(adresse.textContent).toBe(`${window.location.host}/live/ABC123`);
    expect(adresse.textContent).not.toContain('#');
    expect(adresse.textContent).not.toMatch(/^[a-z]+:\/\//i);
    expect(adresse.style.whiteSpace).toBe('nowrap');
    expect(displayFontSizes.qrAddress).toMatch(/^\d+(\.\d+)?vh$/);
    expect(parseFloat(displayFontSizes.qrAddress)).toBeGreaterThanOrEqual(3);
    expect(adresse.style.fontSize).toBe(displayFontSizes.qrAddress);
    expect(screen.getByTestId('qr-code').getAttribute('data-value')).toBe(`${window.location.origin}/#/live/ABC123`);
  });

  it('der QR-Code hat einen Alternativtext', () => {
    render(<QrSlide tournament={createMockTournament({ isPublic: true, shareCode: 'ABC123' })} style={{}} />);
    expect(screen.getByTestId('qr-code').getAttribute('data-title')).toBeTruthy();
  });

  it('Gegenbeispiel: ohne öffentliches Turnier gibt es weder QR-Code noch Adresse', () => {
    render(<QrSlide tournament={createMockTournament({ isPublic: false, shareCode: 'ABC123' })} style={{}} />);
    expect(screen.queryByTestId('qr-code')).toBeNull();
    expect(screen.queryByTestId('qr-address')).toBeNull();
  });

  it('qrTypedAddress entfernt Schema und „#/“, nie den Pfad oder die Kennung', () => {
    expect(qrTypedAddress('https://halle.example/#/live/ABC123')).toBe('halle.example/live/ABC123');
    expect(qrTypedAddress('http://localhost:3000/#/live/ABC123')).toBe('localhost:3000/live/ABC123');
    expect(qrTypedAddress('halle.example/live/ABC123')).toBe('halle.example/live/ABC123');
  });
});
