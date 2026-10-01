import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { AuthUser } from '../../middleware/auth';
import { GeminiToolExecutor, ToolExecutionResult } from './GeminiToolExecutor';

export interface ChatContext {
  page?: string;
  entityId?: string;
  departmentId?: string;
  categoryId?: string;
  amount?: number;
  quotationId?: string;
  [key: string]: any;
}

export interface ChatResponse {
  success: boolean;
  answer: string;
  sources: Array<{ type: string; id?: string; name: string; summary: string }>;
  contextUsed: Record<string, any>;
  generatedAt: string;
  modelUsed: string;
  providerStatus: 'ONLINE' | 'FALLBACK_LOCAL' | 'UNAVAILABLE';
}

export class GeminiService {
  public static getApiKey(): string {
    return (process.env.GEMINI_API_KEY || '').trim();
  }

  public static getModel(): string {
    return (process.env.GEMINI_MODEL || 'gemini-1.5-flash').trim();
  }

  public static isKeyConfigured(): boolean {
    const key = this.getApiKey();
    return Boolean(key && key !== 'your_gemini_api_key' && key !== 'YOUR_GEMINI_API_KEY' && key !== 'test_key');
  }

  public static getStatus() {
    const isConfigured = this.isKeyConfigured();
    const key = this.getApiKey();
    const maskedKey = key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : '';
    return {
      provider: 'Google Gemini',
      agent: 'ATCS Gemini Agent',
      model: this.getModel(),
      isConfigured,
      maskedKey,
      status: isConfigured ? 'READY' : 'LOCAL_FALLBACK',
    };
  }

  public static async updateApiKey(newKey: string, newModel?: string): Promise<{ success: boolean; message: string }> {
    const trimmedKey = newKey.trim();
    const modelToUse = (newModel || this.getModel()).trim();

    if (!trimmedKey) {
      throw new Error('API key cannot be empty');
    }

    // Lightweight verification ping against Gemini API
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${trimmedKey}`;
      await axios.post(
        endpoint,
        {
          contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
          generationConfig: { maxOutputTokens: 5 },
        },
        { timeout: 5000 }
      );
    } catch (pingErr: any) {
      const msg = pingErr.response?.data?.error?.message || pingErr.message;
      throw new Error(`Google Gemini validation error: ${msg}`);
    }

    process.env.GEMINI_API_KEY = trimmedKey;
    if (newModel) {
      process.env.GEMINI_MODEL = modelToUse;
    }

    // Persist to backend .env file
    try {
      const envPath = path.resolve(__dirname, '../../../.env');
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf-8');
        if (envContent.includes('GEMINI_API_KEY=')) {
          envContent = envContent.replace(/GEMINI_API_KEY=.*/g, `GEMINI_API_KEY="${trimmedKey}"`);
        } else {
          envContent += `\nGEMINI_API_KEY="${trimmedKey}"\n`;
        }
        if (newModel) {
          if (envContent.includes('GEMINI_MODEL=')) {
            envContent = envContent.replace(/GEMINI_MODEL=.*/g, `GEMINI_MODEL="${modelToUse}"`);
          } else {
            envContent += `GEMINI_MODEL="${modelToUse}"\n`;
          }
        }
        fs.writeFileSync(envPath, envContent, 'utf-8');
      }
    } catch (e) {
      console.warn('[GeminiService]: Could not update .env file, active in runtime memory.');
    }

    return {
      success: true,
      message: `Gemini API key verified and saved successfully.`,
    };
  }

  /**
   * System Prompt enforcing ATCS Financial Intelligence Rules for Google Gemini
   */
  private static getSystemPrompt(user: AuthUser): string {
    return `You are the ATCS Gemini Agent, the AI Financial Intelligence Layer for ATCS (Audit Trailing & Control System) powered by Google Gemini.

CRITICAL OPERATIONAL RULES:
1. You are an ASSISTANT and INTELLIGENCE LAYER on top of the existing ATCS backend.
2. The ATCS backend and its PostgreSQL database are the ONLY authoritative source of truth.
3. You have READ-ONLY access. You can NEVER approve, reject, create, modify, or commit financial transactions, budgets, or rules.
4. If a user asks you to approve or reject a request or change financial data, respond: "Approvals and modifications must occur through authorized ATCS workflow controls. As an AI assistant, I operate strictly in read-only mode."
5. Never invent or hallucinate financial values, numbers, allocations, or transactions. If data is not provided in the authoritative ATCS context, say: "I don't have enough ATCS data to determine that."
6. Never override or contradict the SpendDecisionEngine results.
7. Keep these financial concepts strictly distinct:
   - Actual Spend (settled transactions)
   - Committed Spend (active approved commitments)
   - Available Budget (budget - actual - committed)
   - Proposed Spend (new spending request)
   - Projected Spend (actual + committed + proposed)
   - Current Violation
   - Projected Violation
   - Approval Required
   - Warning
   - Exception
8. Response Format: Be concise, clear, and professional. Use this structure:
   - Summary
   - Key Numbers (bullet points with currency ₹)
   - Reason / Governance Context
   - Impact / Risk Analysis
   - Recommended ATCS Action
9. The authenticated user is "${user.name}" with role "${user.role}"${user.departmentId ? ` in department ID "${user.departmentId}"` : ''}. Respect user data isolation.`;
  }

  /**
   * Orchestrates tool execution based on user prompt and page context,
   * gathers authoritative ATCS data, and synthesizes the response with Google Gemini.
   */
  public static async processChat(
    message: string,
    context: ChatContext = {},
    user: AuthUser
  ): Promise<ChatResponse> {
    const startTime = Date.now();
    const generatedAt = new Date().toISOString();

    // 1. Tool Selection & Execution
    const { results, sources, contextSummary } = await this.executeRelevantTools(message, context, user);

    // 2. Check if Gemini API key is configured
    const apiKey = this.getApiKey();
    const model = this.getModel();

    if (!this.isKeyConfigured()) {
      // Local Authoritative Intelligence Fallback (ATCS numbers remain 100% accurate)
      const answer = this.generateAuthoritativeLocalResponse(message, results, context, user);
      return {
        success: true,
        answer: `${answer}\n\n> *[Gemini Agent Status: Operating in ATCS local intelligence mode. To enable remote Gemini LLM synthesis, configure GEMINI_API_KEY in backend/.env]*`,
        sources,
        contextUsed: contextSummary,
        generatedAt,
        modelUsed: 'atcs-local-rules-engine',
        providerStatus: 'FALLBACK_LOCAL',
      };
    }

    // 3. Remote Google Gemini API Call
    try {
      const systemPrompt = this.getSystemPrompt(user);
      const userContent = `User Question: "${message}"\n\nPage Context: ${context.page || 'General'}\n\nAuthoritative ATCS Backend Data:\n${JSON.stringify(results, null, 2)}`;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await axios.post(
        endpoint,
        {
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: userContent }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1200,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 4500, // 4.5s fast timeout to prevent UI lag
        }
      );

      const candidate = response.data?.candidates?.[0];
      const answerText = candidate?.content?.parts?.[0]?.text;

      if (!answerText || answerText.trim() === '') {
        throw new Error('Gemini API returned empty candidate content');
      }

      return {
        success: true,
        answer: answerText.trim(),
        sources,
        contextUsed: contextSummary,
        generatedAt,
        modelUsed: model,
        providerStatus: 'ONLINE',
      };
    } catch (err: any) {
      console.warn('[GeminiService]: Remote Gemini API call failed, activating graceful fallback:', err.response?.data || err.message);

      // Handle specific provider errors
      const statusCode = err?.response?.status;
      const isRateLimit = statusCode === 429;
      const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
      const isAuthError = statusCode === 400 || statusCode === 401 || statusCode === 403;

      let errorNotice = '';
      if (isRateLimit) {
        errorNotice = '\n\n> *[Note: Google Gemini quota/rate limit reached. Authoritative ATCS calculations served directly.]*';
      } else if (isTimeout) {
        errorNotice = '\n\n> *[Note: Google Gemini request timed out. Authoritative ATCS calculations served directly.]*';
      } else if (isAuthError) {
        errorNotice = '\n\n> *[Note: Google Gemini API key error. Check GEMINI_API_KEY in backend/.env. Authoritative ATCS calculations served directly.]*';
      } else {
        errorNotice = `\n\n> *[Note: Gemini connection issue (${err.message || 'remote error'}). Authoritative ATCS calculations served directly.]*`;
      }

      // Generate local authoritative fallback response
      const fallbackAnswer = this.generateAuthoritativeLocalResponse(message, results, context, user);

      return {
        success: true,
        answer: `${fallbackAnswer}${errorNotice}`,
        sources,
        contextUsed: contextSummary,
        generatedAt,
        modelUsed: 'atcs-local-rules-engine',
        providerStatus: 'FALLBACK_LOCAL',
      };
    }
  }

  /**
   * Intelligently selects and executes relevant read-only ATCS tools
   */
  private static async executeRelevantTools(
    message: string,
    context: ChatContext,
    user: AuthUser
  ): Promise<{
    results: Record<string, any>;
    sources: Array<{ type: string; id?: string; name: string; summary: string }>;
    contextSummary: Record<string, any>;
  }> {
    const results: Record<string, any> = {};
    const sources: Array<{ type: string; id?: string; name: string; summary: string }> = [];
    const contextSummary: Record<string, any> = { ...context };

    const lower = message.toLowerCase();

    // 1. Spending Simulation requested ("what happens if I spend ₹50k", "can we afford", "simulate")
    const isSimulate =
      lower.includes('what happens if') ||
      lower.includes('spend more') ||
      lower.includes('afford') ||
      lower.includes('simulate') ||
      lower.includes('increase');

    if (isSimulate && (context.amount || extractAmountFromText(message))) {
      const amount = context.amount || extractAmountFromText(message) || 0;
      const deptId = context.departmentId || user.departmentId;
      const catId = context.categoryId;

      if (deptId && catId && amount > 0) {
        const simRes = await GeminiToolExecutor.simulateSpending(
          { departmentId: deptId, categoryId: catId, amount },
          user
        );
        results['simulate_spending'] = simRes.data;
        sources.push(...simRes.sources);
      }
    }

    // 2. Spending Request explanation ("Why was this request rejected?", "Why does this require approval?")
    if (context.entityId && (context.page === 'spending-request' || context.page === 'spend' || lower.includes('request') || lower.includes('rejected') || lower.includes('approval'))) {
      const reqRes = await GeminiToolExecutor.getSpendingRequest(context.entityId, user);
      if (reqRes.success) {
        results['spending_request'] = reqRes.data;
        sources.push(...reqRes.sources);
      }
    }

    // 3. Client Quotation & Budget ("summarize quotation", "estimated margin", "leftover budget")
    if (context.page === 'client-budget' || lower.includes('quotation') || lower.includes('margin') || lower.includes('client contract')) {
      const quoteRes = await GeminiToolExecutor.getClientQuotation(context.quotationId, user);
      if (quoteRes.success) {
        results['client_quotation'] = quoteRes.data;
        sources.push(...quoteRes.sources);
      }
    }

    // 4. Budget Utilization & Department Budgets ("utilization", "budget limits", "highest utilization")
    if (lower.includes('utilization') || lower.includes('budget') || lower.includes('limit') || context.page === 'budgets') {
      const deptId = context.departmentId || (user.role === 'MANAGER' ? user.departmentId : undefined);
      if (deptId) {
        const utilRes = await GeminiToolExecutor.getDepartmentUtilization(deptId, user);
        if (utilRes.success) {
          results['department_utilization'] = utilRes.data;
          sources.push(...utilRes.sources);
        }
      }
    }

    // 5. Commitments ("commitments", "outstanding")
    if (lower.includes('commitment') || lower.includes('outstanding') || context.page === 'commitments') {
      const deptId = context.departmentId || user.departmentId || undefined;
      const commRes = await GeminiToolExecutor.getCommitments(deptId, user);
      if (commRes.success) {
        results['commitments'] = commRes.data;
        sources.push(...commRes.sources);
      }
    }

    // 6. Forecast ("forecast", "projected violation", "burn rate")
    if (lower.includes('forecast') || lower.includes('projected') || context.page === 'forecasts') {
      const deptId = context.departmentId || user.departmentId;
      if (deptId) {
        const fCastRes = await GeminiToolExecutor.getForecast(deptId, context.categoryId, user);
        if (fCastRes.success) {
          results['forecast'] = fCastRes.data;
          sources.push(...fCastRes.sources);
        }
      }
    }

    // 7. Alerts ("alert", "risk", "warning")
    if (lower.includes('alert') || lower.includes('warning') || lower.includes('risk') || context.page === 'alerts') {
      const deptId = context.departmentId || user.departmentId || undefined;
      const alertRes = await GeminiToolExecutor.getAlerts(deptId, user);
      if (alertRes.success) {
        results['alerts'] = alertRes.data;
        sources.push(...alertRes.sources);
      }
    }

    // 8. Default fallback: Dashboard Executive Summary
    if (Object.keys(results).length === 0 || lower.includes('summary') || lower.includes('situation') || context.page === 'dashboard') {
      const dashRes = await GeminiToolExecutor.getDashboardSummary(user);
      if (dashRes.success) {
        results['dashboard_summary'] = dashRes.data;
        sources.push(...dashRes.sources);
      }
    }

    return { results, sources, contextSummary };
  }

  /**
   * Deterministic local financial explanation engine.
   * Produces concise, professional summaries using exact ATCS backend calculations.
   */
  private static generateAuthoritativeLocalResponse(
    message: string,
    toolResults: Record<string, any>,
    context: ChatContext,
    user: AuthUser
  ): string {
    const lower = message.toLowerCase();

    // Check rejection / approval refusal questions
    if (lower.includes('approve') && (lower.startsWith('approve') || lower.includes('please approve') || lower.includes('can you approve'))) {
      return `### Action Restricted: Workflow Authorization Required

**Summary:** Gemini Agent cannot approve or modify spending requests.

**Reason:** In accordance with ATCS governance controls, all financial approvals must be authorized by designated managers or finance officers through the official Approvals workflow.

**Recommended ATCS Action:** Please navigate to the **Approvals** screen in ATCS to review and approve pending requests within your authority limit.`;
    }

    // Spend Simulation Result Explanation
    if (toolResults.simulate_spending) {
      const s = toolResults.simulate_spending;
      const isApproved = s.decision === 'APPROVE';
      const isViolation = s.decision === 'VIOLATION';
      const isApprovalReq = s.decision === 'APPROVAL_REQUIRED';

      let statusWord = isApproved ? 'Approved' : isViolation ? 'Blocked / Policy Violation' : 'Requires Approval';

      return `### Spend Simulation Analysis (${s.departmentName} - ${s.categoryName})

**Summary:** Proposed spend of **₹${s.proposedAmount.toLocaleString()}** evaluated with verdict: **${statusWord}**.

**Key Numbers:**
• Governing Budget: ₹${s.budgetAmount.toLocaleString()}
• Current Actual Spend: ₹${s.actualSpend.toLocaleString()}
• Outstanding Commitments: ₹${s.committedSpend.toLocaleString()}
• Available Before Request: ₹${s.availableBefore.toLocaleString()}
• Projected Total Spend: ₹${s.projectedSpend.toLocaleString()}
• Remaining After Request: ₹${s.remainingAfter.toLocaleString()}
• Utilization: **${s.utilizationBefore}%** → **${s.utilizationAfter}%**

**Governance Context:**
${s.violations.length > 0 ? `• **Violations:** ${s.violations.join('\n• ')}` : ''}
${s.warnings.length > 0 ? `• **Warnings:** ${s.warnings.join('\n• ')}` : ''}
${s.reasons.length > 0 ? `• **Rationale:** ${s.reasons.join('\n• ')}` : ''}

**Impact:** ${isViolation ? `This expenditure will cause a budget overrun of ₹${Math.abs(s.remainingAfter).toLocaleString()}.` : isApprovalReq ? `Exceeds discretionary threshold; requires ${s.requiredApproverRole} review.` : 'Expenditure remains safely within allocated budget.'}

**Recommended ATCS Action:** ${isViolation ? 'Submit a formal Budget Exception request or reallocate departmental funds.' : isApprovalReq ? 'Submit spending request for management review.' : 'Proceed with spending request submission.'}`;
    }

    // Spending Request / Rejection Explanation
    if (toolResults.spending_request) {
      const r = toolResults.spending_request;
      const snap = r.decisionSnapshot;

      if (!snap) {
        return `### Spending Request Details (${r.vendor})

**Summary:** Spending request of **₹${r.requestedAmount.toLocaleString()}** by ${r.employeeName} for **${r.categoryName}**.
• Status: **${r.status}**
• Department: **${r.departmentName}**
• Vendor: **${r.vendor}**
• Description: ${r.description}

*Note: No automated decision snapshot recorded for this legacy request.*`;
      }

      return `### Decision Explanation for Request #${r.id.slice(0, 8)}

**Summary:** The spending request of **₹${snap.requestedAmount.toLocaleString()}** was evaluated with verdict: **${snap.decision}** (${snap.budgetStatus}).

**Key Numbers:**
• Approved Department Budget: ₹${snap.budgetAmount.toLocaleString()}
• Actual Settled Spend: ₹${snap.actualSpend.toLocaleString()}
• Outstanding Commitments: ₹${snap.committedSpend.toLocaleString()}
• Available Before Request: ₹${snap.remainingBefore.toLocaleString()}
• Projected Spend with Request: ₹${(snap.actualSpend + snap.committedSpend + snap.requestedAmount).toLocaleString()}
• Projected Remaining: ₹${snap.remainingAfter.toLocaleString()}
• Utilization Shift: ${snap.utilizationBefore}% → **${snap.utilizationAfter}%**

**Reason:**
${snap.violations.length > 0 ? `• Violations: ${snap.violations.join('; ')}` : ''}
${snap.warnings.length > 0 ? `• Warnings: ${snap.warnings.join('; ')}` : ''}
${snap.reasons.length > 0 ? `• Rationale: ${snap.reasons.join('; ')}` : ''}

**Impact:** ${snap.decision === 'VIOLATION' ? 'Blocked to preserve departmental budget integrity.' : 'Requires managerial oversight per governance policy.'}

**Recommended ATCS Action:** ${snap.decision === 'VIOLATION' ? 'File a formal Budget Exception under Governance > Exceptions.' : 'Await designated approver sign-off in the Approvals queue.'}`;
    }

    // Client Quotation Explanation
    if (toolResults.client_quotation) {
      const q = toolResults.client_quotation;
      const fs = q.financialSummary;
      const eoc = q.estimationOfCompletion;

      const isBelowMargin = fs.profitMarginPct < fs.targetProfitMarginPct;

      return `### Client Quotation & Budget Summary (${q.quotation.clientName})

**Summary:** Project **${q.quotation.projectName}** (Ref: ${q.quotation.quotationReference}) financial position.

**Key Numbers:**
• Proposed Client Budget: **₹${fs.grossProposedBudget.toLocaleString()}**
• Incurred Actual Spend: ₹${fs.totalActualSpend.toLocaleString()}
• Committed Expenses: ₹${fs.totalCommittedSpend.toLocaleString()}
• Total Incurred Expenses: ₹${fs.totalIncurredExpenses.toLocaleString()}
• Leftover / Net Margin: **₹${fs.leftoverBudget.toLocaleString()}**
• Current Profit Margin: **${fs.profitMarginPct}%** (Target: ${fs.targetProfitMarginPct}%)
• Estimated Cost at Completion: ₹${eoc.estimatedCostAtCompletion.toLocaleString()}
• Estimated Completion Margin: **${eoc.estimatedCompletionMarginPct}%**

**Impact:** ${isBelowMargin ? '⚠️ Current profit margin is below the configured contractual target.' : '✅ Project finances are currently performing within profitability targets.'} ${eoc.narrative}

**Recommended ATCS Action:** Review department-specific expense allocations in the Client Contract & Quotation Hub to safeguard target profit margins.`;
    }

    // Department Utilization Explanation
    if (toolResults.department_utilization) {
      const u = toolResults.department_utilization;
      return `### Department Budget Utilization: ${u.departmentName}

**Summary:** Current fiscal period **${u.fiscalPeriod}** is operating at **${u.utilizationPercentage}%** utilization.

**Key Numbers:**
• Total Allocated Budget: **₹${u.budgetAmount.toLocaleString()}**
• Actual Incurred Spend: ₹${u.actualSpend.toLocaleString()}
• Active Commitments: ₹${u.committedSpend.toLocaleString()}
• Available Balance: **₹${u.availableBudget.toLocaleString()}**

**Category Breakdown:**
${u.categoryBreakdown.map((c: any) => `• **${c.categoryName}:** ₹${c.actualSpend.toLocaleString()} spent (${c.utilizationPercentage}% of ₹${c.allocatedAmount.toLocaleString()})`).join('\n')}

**Impact:** ${u.utilizationPercentage >= 90 ? 'Critical budget pressure. Overspending risks are high.' : u.utilizationPercentage >= 75 ? 'Approaching warning threshold.' : 'Spend is healthy and well within allocated limits.'}

**Recommended ATCS Action:** ${u.utilizationPercentage >= 80 ? 'Monitor discretionary hardware and consulting purchase requests closely.' : 'Continue normal spending operations.'}`;
    }

    // Commitments Summary
    if (toolResults.commitments) {
      const c = toolResults.commitments;
      return `### Active Commitments Summary

**Summary:** There are currently **${c.count}** active commitments with a total outstanding balance of **₹${c.totalOutstandingAmount.toLocaleString()}**.

**Largest Active Commitments:**
${c.commitments.slice(0, 5).map((item: any) => `• **₹${item.remainingAmount.toLocaleString()}** (${item.vendor}) - ${item.department} [${item.category}]`).join('\n')}

**Impact:** These funds are pre-allocated and ring-fenced from available budgets pending invoice receipt.

**Recommended ATCS Action:** Coordinate with vendors to reconcile invoices and settle outstanding commitments against bank ledger transactions.`;
    }

    // Default: Executive Dashboard Summary
    if (toolResults.dashboard_summary) {
      const d = toolResults.dashboard_summary;
      const kpis = d.kpis;

      const highestDept = [...d.departments].sort((a, b) => b.utilization - a.utilization)[0];

      return `### ATCS Financial Situation Summary

**Summary:** Enterprise budget utilization is currently at **${kpis.overallUtilization}%**.

**Key Numbers:**
• Total Approved Budget: **₹${kpis.totalBudget.toLocaleString()}**
• Actual Settled Spend: ₹${kpis.actualSpend.toLocaleString()}
• Committed Pre-allocations: ₹${kpis.committedSpend.toLocaleString()}
• Available Working Budget: **₹${kpis.availableBudget.toLocaleString()}**
• Active Policy Violations: **${kpis.activeViolationsCount}**
• Pending Approvals: **${kpis.pendingApprovalsCount}**

${highestDept ? `**Highest Utilization Department:** **${highestDept.departmentName}** at **${highestDept.utilization}%** (₹${highestDept.actual.toLocaleString()} actual + ₹${highestDept.committed.toLocaleString()} committed of ₹${highestDept.budget.toLocaleString()}).` : ''}

**Impact:** ${kpis.activeViolationsCount > 0 ? `There are ${kpis.activeViolationsCount} spending attempts blocked by SpendDecisionEngine requiring managerial review.` : 'All monitored departments are operating within policy thresholds.'}

**Recommended ATCS Action:** ${kpis.pendingApprovalsCount > 0 ? `Review the ${kpis.pendingApprovalsCount} pending approvals in the queue to prevent operational bottlenecks.` : 'Financial controls are functioning normally.'}`;
    }

    return `I don't have enough ATCS data to determine that for the current context. Please specify a department, spending request ID, or use one of the suggested financial questions.`;
  }
}

/**
 * Extracts a numeric amount from a natural language query like "spend ₹50,000" or "spend 50000"
 */
function extractAmountFromText(text: string): number | null {
  const regex = /(?:₹|rs\.?|inr)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)\s*(?:k|lakh|lakhs|lac|crore|crores)?/i;
  const match = text.match(regex);
  if (!match) return null;

  let raw = match[1].replace(/,/g, '');
  let val = parseFloat(raw);
  if (isNaN(val)) return null;

  const lower = text.toLowerCase();
  if (lower.includes('lakh') || lower.includes('lac')) {
    val = val * 100000;
  } else if (lower.includes('crore')) {
    val = val * 10000000;
  } else if (lower.includes('k') && val < 1000) {
    val = val * 1000;
  }

  return val;
}
