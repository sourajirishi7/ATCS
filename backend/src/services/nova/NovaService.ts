import { GeminiService, ChatContext, ChatResponse } from '../gemini/GeminiService';
import { GeminiToolExecutor, ToolExecutionResult } from '../gemini/GeminiToolExecutor';

export { ChatContext, ChatResponse, ToolExecutionResult };

/**
 * NovaService is an alias for GeminiService for backward compatibility.
 * All intelligence calls now route through the Gemini Agent engine.
 */
export class NovaService extends GeminiService {}
export const NovaToolExecutor = GeminiToolExecutor;
