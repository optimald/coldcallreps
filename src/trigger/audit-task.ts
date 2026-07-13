/**
 * Trigger.dev v3 task entry — audit-call-task (handoff §5).
 * Implementation lives in src/lib/pipeline/audit-call.ts and runs inline
 * via dispatchPipelineTask until TRIGGER_SECRET_KEY is configured.
 */
export { auditCallTask as default, auditCallTask, AUDIT_CALL_TASK_ID } from '@/trigger/tasks';
