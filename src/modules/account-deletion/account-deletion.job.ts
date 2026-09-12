import { accountDeletionService } from './account-deletion.service';

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

/** Check every hour for website holds that have reached scheduled_for. */
const CHECK_MS = 60 * 60 * 1000;

export async function runAccountDeletionDueCheck(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const processed = await accountDeletionService.processDueRequests();
    if (processed > 0) {
      console.log(
        `[account-deletion] Processed ${processed} due deletion request(s)`
      );
    }
  } catch (err) {
    console.error(
      '[account-deletion] Due check failed:',
      err instanceof Error ? err.message : err
    );
  } finally {
    running = false;
  }
}

export function startAccountDeletionJob(): void {
  if (timer) return;

  setTimeout(() => {
    void runAccountDeletionDueCheck();
  }, 20_000);

  timer = setInterval(() => {
    void runAccountDeletionDueCheck();
  }, CHECK_MS);

  if (typeof timer === 'object' && 'unref' in timer) {
    timer.unref();
  }

  console.log(
    `[account-deletion] Due-deletion job started (every ${CHECK_MS}ms)`
  );
}
