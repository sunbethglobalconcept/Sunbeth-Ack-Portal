import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import CompletedBatch from '../components/CompletedBatch';

// Mocks
jest.mock('react-router-dom', () => ({
  ...(jest.requireActual('react-router-dom') as any),
  useParams: () => ({ id: 'batch-123' })
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ token: 'tok', account: { username: 'user@example.com', name: 'Test User' } })
}));

jest.mock('../context/ExternalAuthContext', () => ({
  useExternalAuth: () => ({ user: null })
}));

jest.mock('../services/dbService', () => ({
  getDocumentsByBatch: jest.fn(async () => ([
    { toba_documentid: 'd1', toba_title: 'Policy A' },
    { toba_documentid: 'd2', toba_title: 'Policy B' }
  ])),
  getAcknowledgedDocIds: jest.fn(async () => (['d1', 'd2'])),
  getBatches: jest.fn(async () => ([{ toba_batchid: 'batch-123', toba_name: 'Employee Handbook 2025' }]))
}));

const mockGenerate = jest.fn(async () => ({
  name: 'certificate-Employee-Handbook-2025.pdf',
  contentBytes: Buffer.from('%PDF-1.4 minimal').toString('base64'),
  contentType: 'application/pdf'
}));

jest.mock('../services/notificationService', () => ({
  generateCertificatePdf: (...args: any[]) => (mockGenerate as any)(...args)
}));

// atob/URL mocks for JSDOM
Object.defineProperty(window, 'atob', {
  value: (b64: string) => Buffer.from(b64, 'base64').toString('binary')
});

const createObjectURL = jest.fn(() => 'blob:mock');
const revokeObjectURL = jest.fn();
Object.defineProperty(window.URL, 'createObjectURL', { value: createObjectURL });
Object.defineProperty(window.URL, 'revokeObjectURL', { value: revokeObjectURL });

describe('CompletedBatch certificate download', () => {
  it.skip('renders button and triggers PDF generation + download', async () => {
    render(
      <MemoryRouter initialEntries={["/batch/batch-123/completed"]}>
        <CompletedBatch />
      </MemoryRouter>
    );

    // Wait for docs to load and button to appear
    await waitFor(() => {
      expect(screen.getByText('Completed Documents')).toBeInTheDocument();
    });

    // Wait for acknowledged docs to render
    await waitFor(() => {
      expect(screen.getByText('Policy A')).toBeInTheDocument();
    });
    const btn = screen.getByRole('button', { name: /download certificate/i });
    expect(btn).toBeEnabled();

    // Click to download
    fireEvent.click(btn);

    // Busy state
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /preparing/i })).toBeDisabled();
    });

    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalledTimes(1);
    });

    // Verify payload shape minimally
    const payload = mockGenerate.mock.calls[0][0];
    expect(payload.batchName).toBe('Employee Handbook 2025');
    expect(payload.userEmail).toBe('user@example.com');
    expect(Array.isArray(payload.documents)).toBe(true);

    // Blob URL created and revoked
    expect(createObjectURL).toHaveBeenCalled();
  });
});
