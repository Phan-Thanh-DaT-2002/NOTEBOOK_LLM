import { execSync } from 'child_process';

const port = process.env.PORT || process.argv[2] || '3000';

console.log(`[Port Killer] Checking and freeing port ${port}...`);

try {
  if (process.platform === 'win32') {
    let output = '';
    try {
      // Find connections on the port
      output = execSync(`netstat -ano`, { encoding: 'utf8' });
    } catch (e) {
      console.error('[Port Killer] Failed to run netstat:', e.message);
    }
    
    if (output && output.trim()) {
      const lines = output.trim().split('\n');
      const pids = new Set();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
          const localAddress = parts[1];
          const state = parts[3];
          const pid = parts[parts.length - 1];
          
          // Check if the local address ends with :<port> (e.g. 0.0.0.0:3000 or [::]:3000)
          if (localAddress && localAddress.endsWith(`:${port}`) && /^\d+$/.test(pid) && pid !== '0') {
            pids.add(pid);
          }
        }
      }
      
      if (pids.size > 0) {
        for (const pid of pids) {
          console.log(`[Port Killer] Killing process ${pid} occupying local port ${port}...`);
          try {
            execSync(`taskkill /F /PID ${pid}`);
            console.log(`[Port Killer] Successfully killed process ${pid}.`);
          } catch (err) {
            console.error(`[Port Killer] Failed to kill process ${pid}:`, err.message);
          }
        }
      } else {
        console.log(`[Port Killer] Port ${port} is already free.`);
      }
    } else {
      console.log(`[Port Killer] Port ${port} is already free.`);
    }
  } else {
    // macOS / Linux
    let output = '';
    try {
      output = execSync(`lsof -t -i:${port}`, { encoding: 'utf8' });
    } catch (e) {
      // lsof returns non-zero if no process matches
    }
    
    if (output && output.trim()) {
      const pids = output.trim().split('\n');
      for (const pid of pids) {
        if (/^\d+$/.test(pid)) {
          console.log(`[Port Killer] Killing process ${pid} occupying port ${port}...`);
          try {
            execSync(`kill -9 ${pid}`);
            console.log(`[Port Killer] Successfully killed process ${pid}.`);
          } catch (err) {
            console.error(`[Port Killer] Failed to kill process ${pid}:`, err.message);
          }
        }
      }
    } else {
      console.log(`[Port Killer] Port ${port} is already free.`);
    }
  }
} catch (error) {
  console.error(`[Port Killer] Error checking/killing port ${port}:`, error.message);
}
