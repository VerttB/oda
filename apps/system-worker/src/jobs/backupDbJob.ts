import { spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { BackupDbJob, BackupDbResult } from '@oda/queue';

const execFile = promisify(spawn);

export async function handleBackupDbJob(job: { data: BackupDbJob }): Promise<BackupDbResult> {
  const { format = 'custom', retentionDays = 7 } = job.data;
  const scriptPath = '../../scripts/backup-db.sh';
  const args = [
    '--format', format,
    '--retention-days', String(retentionDays),
  ];

  return new Promise((resolve) => {
    const child = spawn('bash', [scriptPath, ...args], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ROOT_DIR: process.cwd() },
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => { stdout += data.toString(); });
    child.stderr?.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      if (code === 0) {
        // Extract backup file path from stdout
        const match = stdout.match(/backup_[^.\s]+\.(sql|dump)/);
        const filePath = match ? `backups/db/${match[0]}` : undefined;
        resolve({ success: true, filePath });
      } else {
        resolve({ success: false, error: stderr || `Exit code ${code}` });
      }
    });

    child.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

export type { BackupDbJob, BackupDbResult } from '@oda/queue';