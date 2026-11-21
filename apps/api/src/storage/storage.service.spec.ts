import { parsePhotoKey } from './storage.service.js';

const id = '3f2b8c1e-1111-4222-8333-444455556666';

describe('parsePhotoKey', () => {
  it('accepts a normal delivery photo key', () => {
    expect(parsePhotoKey(`deliveries/${id}/2026/${id}.jpg`)).toEqual({ distributorId: id, mime: 'image/jpeg' });
  });

  it('rejects path tricks and other folders', () => {
    expect(parsePhotoKey(`deliveries/${id}/2026/../../../etc/passwd`)).toBeNull();
    expect(parsePhotoKey(`../deliveries/${id}/2026/${id}.jpg`)).toBeNull();
    expect(parsePhotoKey(`other/${id}/2026/${id}.jpg`)).toBeNull();
    expect(parsePhotoKey(`deliveries/${id}/2026/${id}.exe`)).toBeNull();
  });
});
