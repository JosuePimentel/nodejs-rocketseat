import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { database } from '../database';
import { CheckIfSessionIdExists } from '../middlewares/check-if-session-id-exists';

export async function transactionsRoutes(app: FastifyInstance) {
  app.post('/', async (request, response) => {
    const createTransactionsBodySchema = z.object({
      title: z.string(),
      amount: z.number(),
      type: z.enum(['credit', 'debit']),
    });

    const { title, amount, type } = createTransactionsBodySchema.parse(
      request.body,
    );

    let sessionId = request.cookies.sessionId;

    if (!sessionId) {
      sessionId = randomUUID();
      response.cookie('sessionId', sessionId, {
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    }

    await database('transactions').insert({
      id: randomUUID(),
      title,
      amount: type === 'credit' ? amount : amount * -1,
      session_id: sessionId,
    });

    return response.status(201).send();
  });

  app.get(
    '/:id',
    {
      preHandler: [CheckIfSessionIdExists],
    },
    async (request) => {
      const getTransactionsParamsSchema = z.object({
        id: z.string().uuid(),
      });

      const { id } = getTransactionsParamsSchema.parse(request.params);
      const { sessionId } = request.cookies;

      const transactions = await database('transactions')
        .where({
          id,
          session_id: sessionId,
        })
        .first();

      return { transactions };
    },
  );

  app.get(
    '/',
    {
      preHandler: [CheckIfSessionIdExists],
    },
    async (request) => {
      const { sessionId } = request.cookies;

      const transactions = await database('transactions')
        .select()
        .where('session_id', sessionId);

      return { transactions };
    },
  );

  app.get(
    '/summary',
    {
      preHandler: [CheckIfSessionIdExists],
    },
    async (request) => {
      const { sessionId } = request.cookies;
      const summary = await database('transactions')
        .where({ session_id: sessionId })
        .sum('amount', { as: 'amount' })
        .first();

      return { summary };
    },
  );
}
