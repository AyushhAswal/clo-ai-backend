import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GroqService } from '../src/ai/groq.service';

describe('Chat (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const emailA = 'chat_groq_usera@example.com';
  const emailB = 'chat_groq_userb@example.com';
  let jwtA: string;
  let jwtB: string;

  let relationshipIdA: string;
  let questionId: string;
  let questionText: string;

  const mockGroqService = {
    generateResponse: jest
      .fn()
      .mockResolvedValue('Samajh raha hoon. Kya baat hui hai?'),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GroqService)
      .useValue(mockGroqService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Clean test accounts
    await prisma.user.deleteMany({
      where: { email: { in: [emailA, emailB] } },
    });

    // Register User A
    const resA = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'User A',
        email: emailA,
        password: 'Password123!',
      })
      .expect(201);

    jwtA = (resA.body as { accessToken: string }).accessToken;

    // Register User B
    const resB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'User B',
        email: emailB,
        password: 'Password123!',
      })
      .expect(201);

    jwtB = (resB.body as { accessToken: string }).accessToken;

    // Fetch question template
    const qRes = await request(app.getHttpServer())
      .get('/relationships/questions?relationshipType=Friendship')
      .set('Authorization', `Bearer ${jwtA}`)
      .expect(200);

    const questions = qRes.body as Array<{ id: string; questionText: string }>;
    questionId = questions[0].id;
    questionText = questions[0].questionText;

    // Create relationship for User A
    const relRes = await request(app.getHttpServer())
      .post('/relationships')
      .set('Authorization', `Bearer ${jwtA}`)
      .send({
        name: 'Rahul',
        relationshipType: 'Friendship',
        category: 'Friends',
        photoUrl: null,
        answers: [
          {
            questionId,
            questionText,
            answer: 'Close and solid friendship.',
          },
        ],
      })
      .expect(201);

    relationshipIdA = (relRes.body as { id: string }).id;
  }, 30000);

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [emailA, emailB] } },
    });
    await app.close();
  });

  it('1. Unauthenticated request to /chats/:relationshipId returns 401', async () => {
    await request(app.getHttpServer())
      .get(`/chats/${relationshipIdA}`)
      .expect(401);
  });

  it('2. Authenticated User A can get/create chat with relationship questionnaire context', async () => {
    const res = await request(app.getHttpServer())
      .get(`/chats/${relationshipIdA}`)
      .set('Authorization', `Bearer ${jwtA}`)
      .expect(200);

    const body = res.body as {
      id: string;
      relationshipId: string;
      context: {
        relationship: { name: string; category: string };
        questionnaire: Array<{ questionText: string; answer: string }>;
      };
    };

    expect(body.id).toBeDefined();
    expect(body.relationshipId).toBe(relationshipIdA);
    expect(body.context.relationship.name).toBe('Rahul');
    expect(body.context.questionnaire).toHaveLength(1);
    expect(body.context.questionnaire[0].answer).toBe(
      'Close and solid friendship.',
    );
  });

  it('3. User B CANNOT access User A relationship chat (403 Forbidden)', async () => {
    await request(app.getHttpServer())
      .get(`/chats/${relationshipIdA}`)
      .set('Authorization', `Bearer ${jwtB}`)
      .expect(403);
  });

  it('4. User A sends message -> Groq LLM generates AI response -> ASSISTANT message is returned & persisted', async () => {
    const res = await request(app.getHttpServer())
      .post(`/chats/${relationshipIdA}/messages`)
      .set('Authorization', `Bearer ${jwtA}`)
      .send({ content: 'Rahul se distance feel ho raha hai' })
      .expect(201);

    const msg = res.body as { id: string; role: string; content: string };
    expect(msg.role).toBe('ASSISTANT');
    expect(msg.content).toBe('Samajh raha hoon. Kya baat hui hai?');

    // Verify both USER and ASSISTANT messages exist in chat list
    const getRes = await request(app.getHttpServer())
      .get(`/chats/${relationshipIdA}/messages`)
      .set('Authorization', `Bearer ${jwtA}`)
      .expect(200);

    const list = getRes.body as Array<{ role: string; content: string }>;
    expect(list).toHaveLength(2);
    expect(list[0].role).toBe('USER');
    expect(list[0].content).toBe('Rahul se distance feel ho raha hai');
    expect(list[1].role).toBe('ASSISTANT');
    expect(list[1].content).toBe('Samajh raha hoon. Kya baat hui hai?');
  });

  it('5. User B CANNOT send message to User A relationship chat (403 Forbidden)', async () => {
    await request(app.getHttpServer())
      .post(`/chats/${relationshipIdA}/messages`)
      .set('Authorization', `Bearer ${jwtB}`)
      .send({ content: 'Hacked message' })
      .expect(403);
  });

  it('6. DELETE /chats/:relationshipId deletes chat and cascade messages', async () => {
    await request(app.getHttpServer())
      .delete(`/chats/${relationshipIdA}`)
      .set('Authorization', `Bearer ${jwtA}`)
      .expect(200);

    // Messages should now be empty
    const res = await request(app.getHttpServer())
      .get(`/chats/${relationshipIdA}/messages`)
      .set('Authorization', `Bearer ${jwtA}`)
      .expect(200);

    expect(res.body).toEqual([]);
  });
});
