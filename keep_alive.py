import subprocess
import sys
import time
import os

def keep_alive():
    while True:
        try:
            print("[Kabobchi Bot] Starting bot...")
            process = subprocess.Popen(
                [sys.executable, "bot_runner.py"],
                cwd=os.path.dirname(os.path.abspath(__file__)),
                stdout=sys.stdout,
                stderr=sys.stderr
            )
            process.wait()
            print(f"[Kabobchi Bot] Bot stopped with code {process.returncode}. Restarting in 5s...")
            time.sleep(5)
        except KeyboardInterrupt:
            print("[Kabobchi Bot] Stopped by user.")
            break
        except Exception as e:
            print(f"[Kabobchi Bot] Error: {e}. Restarting in 5s...")
            time.sleep(5)

if __name__ == "__main__":
    keep_alive()
