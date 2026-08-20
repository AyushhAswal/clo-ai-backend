import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Relationships (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const testEmailA = 'usera_e2e@example.com';
  const testEmailB = 'userb_e2e@example.com';
  let jwtA: string;
  let jwtB: string;
  let sampleQuestionId: string;
  let sampleQuestionText: string;
  let createdRelationshipId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Clean test accounts if existing
    await prisma.user.deleteMany({
      where: { email: { in: [testEmailA, testEmailB] } },
    });

    // Register User A
    const resA = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'User A',
        email: testEmailA,
        password: 'Password123!',
      })
      .expect(201);

    jwtA = (resA.body as { accessToken: string }).accessToken;

    // Register User B
    const resB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'User B',
        email: testEmailB,
        password: 'Password123!',
      })
      .expect(201);

    jwtB = (resB.body as { accessToken: string }).accessToken;
  }, 30000);

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [testEmailA, testEmailB] } },
    });
    await app.close();
  });

  it('1. GET /relationships/questions returns seeded questions', async () => {
    const res = await request(app.getHttpServer())
      .get('/relationships/questions?relationshipType=Friendship')
      .set('Authorization', `Bearer ${jwtA}`)
      .expect(200);

    const questions = res.body as Array<{ id: string; questionText: string }>;
    expect(Array.isArray(questions)).toBe(true);
    expect(questions.length).toBeGreaterThan(0);
    sampleQuestionId = questions[0].id;
    sampleQuestionText = questions[0].questionText;
  });

  it('2. POST /relationships creates relationship with answers in transaction', async () => {
    const payload = {
      name: 'Rahul',
      relationshipType: 'Friend',
      category: 'Friends',
      photoUrl: null,
      answers: [
        {
          questionId: sampleQuestionId,
          questionText: sampleQuestionText,
          answer: 'Close, and it feels solid.',
        },
      ],
    };

    const res = await request(app.getHttpServer())
      .post('/relationships')
      .set('Authorization', `Bearer ${jwtA}`)
      .send(payload)
      .expect(201);

    const body = res.body as {
      id: string;
      name: string;
      answers: Array<{ answer: string }>;
    };
    expect(body.id).toBeDefined();
    expect(body.name).toBe('Rahul');
    expect(body.answers).toHaveLength(1);
    expect(body.answers[0].answer).toBe('Close, and it feels solid.');
    createdRelationshipId = body.id;
  });

  it('3. GET /relationships returns only authenticated user relationships with category filter', async () => {
    const res = await request(app.getHttpServer())
      .get('/relationships?category=Friends')
      .set('Authorization', `Bearer ${jwtA}`)
      .expect(200);

    const list = res.body as Array<{ id: string }>;
    expect(Array.isArray(list)).toBe(true);
    expect(list.some((r) => r.id === createdRelationshipId)).toBe(true);
  });

  it('4. GET /relationships/:id returns single relationship with answers', async () => {
    const res = await request(app.getHttpServer())
      .get(`/relationships/${createdRelationshipId}`)
      .set('Authorization', `Bearer ${jwtA}`)
      .expect(200);

    const body = res.body as {
      id: string;
      name: string;
      answers: Array<{ answer: string }>;
    };
    expect(body.id).toBe(createdRelationshipId);
    expect(body.name).toBe('Rahul');
    expect(body.answers).toHaveLength(1);
  });

  it('5. PATCH /relationships/:id updates relationship info and upserts answers', async () => {
    const updatePayload = {
      name: 'Rahul Updated',
      answers: [
        {
          questionId: sampleQuestionId,
          questionText: sampleQuestionText,
          answer: 'Extremely close and solid!',
        },
      ],
    };

    const res = await request(app.getHttpServer())
      .patch(`/relationships/${createdRelationshipId}`)
      .set('Authorization', `Bearer ${jwtA}`)
      .send(updatePayload)
      .expect(200);

    const body = res.body as {
      name: string;
      answers: Array<{ answer: string }>;
    };
    expect(body.name).toBe('Rahul Updated');
    expect(body.answers[0].answer).toBe('Extremely close and solid!');
  });

  it('6. Verify another user (User B) CANNOT access or modify User A relationship', async () => {
    // Attempt GET by User B -> 403 Forbidden
    await request(app.getHttpServer())
      .get(`/relationships/${createdRelationshipId}`)
      .set('Authorization', `Bearer ${jwtB}`)
      .expect(403);

    // Attempt PATCH by User B -> 403 Forbidden
    await request(app.getHttpServer())
      .patch(`/relationships/${createdRelationshipId}`)
      .set('Authorization', `Bearer ${jwtB}`)
      .send({ name: 'Hacked' })
      .expect(403);

    // Attempt DELETE by User B -> 403 Forbidden
    await request(app.getHttpServer())
      .delete(`/relationships/${createdRelationshipId}`)
      .set('Authorization', `Bearer ${jwtB}`)
      .expect(403);
  });

  it('7. DELETE /relationships/:id deletes relationship for authenticated user', async () => {
    await request(app.getHttpServer())
      .delete(`/relationships/${createdRelationshipId}`)
      .set('Authorization', `Bearer ${jwtA}`)
      .expect(200);

    // Verify it no longer exists
    await request(app.getHttpServer())
      .get(`/relationships/${createdRelationshipId}`)
      .set('Authorization', `Bearer ${jwtA}`)
      .expect(404);
  });
});
