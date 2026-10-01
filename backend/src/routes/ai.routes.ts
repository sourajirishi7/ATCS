import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { GeminiService, ChatContext } from '../services/gemini/GeminiService';
import { AuditService } from '../services/AuditService';
import { z } from 'zod';

const router = Router();

const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message is required').max(1000, 'Message cannot exceed 1000 characters'),
  context: z
    .object({
      page: z.string().nullable().optional(),
      entityId: z.string().nullable().optional(),
      departmentId: z.string().nullable().optional(),
      categoryId: z.string().nullable().optional(),
      amount: z.number().nullable().optional(),
      quotationId: z.string().nullable().optional(),
    })
    .passthrough()
    .nullable()
    .optional(),
});

/**
 * GET /api/ai/status
 * Returns current Gemini Agent provider status and configuration info.
 */
router.get('/status', authenticate, async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.json({
    success: true,
    data: GeminiService.getStatus(),
  });
});

/**
 * POST /api/ai/config
 * Allows updating and verifying the Gemini API key and model at runtime.
 */
router.post('/config', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const schema = z.object({
    apiKey: z.string().min(1, 'API key is required'),
    model: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Invalid configuration payload.',
      details: parsed.error.format(),
    });
    return;
  }

  try {
    const result = await GeminiService.updateApiKey(parsed.data.apiKey, parsed.data.model);
    res.json({
      success: true,
      message: result.message,
      data: GeminiService.getStatus(),
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
});

/**
 * POST /api/ai/chat
 * Primary entrypoint for ATCS Gemini AI Agent.
 * Fully authenticated and scoped to user's RBAC permissions.
 */
router.post('/chat', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const startTime = Date.now();
  const parsed = chatRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      errorCode: 'INVALID_CHAT_REQUEST',
      message: 'Invalid request body format.',
      details: parsed.error.format(),
    });
    return;
  }

  const message = parsed.data.message;
  const context: ChatContext = (parsed.data.context as ChatContext) || {};
  const user = req.user!;

  try {
    const result = await GeminiService.processChat(message, context, user);
    const latencyMs = Date.now() - startTime;

    // AI Audit Trail Recording (sanitized, zero secret leakage)
    await AuditService.createLog({
      userId: user.id,
      action: 'AI_QUERY',
      entityType: 'GeminiAgent',
      entityId: context.entityId || context.page || 'general',
      metadata: JSON.stringify({
        question: message.slice(0, 150),
        page: context.page || 'unknown',
        model: result.modelUsed,
        providerStatus: result.providerStatus,
        sourcesCount: result.sources.length,
        latencyMs,
        success: true,
      }),
    });

    res.json({
      success: true,
      data: result,
      answer: result.answer,
      sources: result.sources,
      contextUsed: result.contextUsed,
      generatedAt: result.generatedAt,
      providerStatus: result.providerStatus,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    console.error('[Gemini Chat Route Error]:', err);

    // Audit failure
    await AuditService.createLog({
      userId: user.id,
      action: 'AI_QUERY_FAILED',
      entityType: 'GeminiAgent',
      entityId: context.entityId || context.page || 'general',
      metadata: JSON.stringify({
        question: message.slice(0, 150),
        page: context.page || 'unknown',
        latencyMs,
        error: err.message,
        success: false,
      }),
    });

    res.status(500).json({
      success: false,
      errorCode: 'AI_ASSISTANT_ERROR',
      message: 'Gemini Agent encountered an error processing your query. ATCS financial controls remain active.',
      details: err.message,
    });
  }
});

export default router;
