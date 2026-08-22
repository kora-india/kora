import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { POST } from '../route';
import { prisma } from '@schoolos/db';
import { auth } from '@schoolos/auth';

const takenSubdomain = 'taken-' + Math.random().toString(36).substring(7);
let schoolId: string;

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/school/check-subdomain', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/school/check-subdomain', () => {
  beforeAll(async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'test-user', schoolId: null, role: 'SCHOOL_ADMIN' },
    } as any);

    const school = await prisma.school.create({
      data: { name: 'Taken School', subdomain: takenSubdomain },
    });
    schoolId = school.id;
  });

  afterAll(async () => {
    await prisma.school.delete({ where: { id: schoolId } });
  });

  it('reports an unused subdomain as available', async () => {
    const res = await POST(makeRequest({ subdomain: 'brand-new-' + Math.random().toString(36).substring(7) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.available).toBe(true);
  });

  it('reports a taken subdomain as unavailable', async () => {
    const res = await POST(makeRequest({ subdomain: takenSubdomain }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.available).toBe(false);
  });

  it('rejects an unauthenticated request', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any);

    const res = await POST(makeRequest({ subdomain: 'whatever' }));
    expect(res.status).toBe(401);
  });

  it('rejects an invalid subdomain format', async () => {
    const res = await POST(makeRequest({ subdomain: 'Has Spaces And CAPS' }));
    expect(res.status).toBe(400);
  });
});
