import os
import sys
import httpx

MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "models", "kokoro"))
os.makedirs(MODELS_DIR, exist_ok=True)

FILES = [
    ("voices-v1.0.bin", "https://github.com/nazdridoy/kokoro-tts/releases/download/v1.0.0/voices-v1.0.bin"),
    ("kokoro-v1.0.onnx", "https://github.com/nazdridoy/kokoro-tts/releases/download/v1.0.0/kokoro-v1.0.onnx")
]

def download_file(filename: str, url: str):
    dest_path = os.path.join(MODELS_DIR, filename)
    if os.path.exists(dest_path) and os.path.getsize(dest_path) > 1000000:
        print(f"[Kokoro Downloader] {filename} already exists ({os.path.getsize(dest_path):,} bytes). Skipping.")
        return dest_path

    temp_path = dest_path + ".tmp"
    print(f"[Kokoro Downloader] Downloading {filename} from {url}...")
    sys.stdout.flush()

    with httpx.stream("GET", url, follow_redirects=True, timeout=180.0) as resp:
        resp.raise_for_status()
        total = int(resp.headers.get("content-length", 0))
        downloaded = 0
        with open(temp_path, "wb") as f:
            for chunk in resp.iter_bytes(chunk_size=1024 * 1024):
                f.write(chunk)
                downloaded += len(chunk)
                percent = (downloaded / total * 100) if total else 0
                if downloaded % (5 * 1024 * 1024) < 1024 * 1024:
                    print(f"  {filename}: {downloaded:,} / {total:,} bytes ({percent:.1f}%)")
                    sys.stdout.flush()

    os.replace(temp_path, dest_path)
    print(f"[Kokoro Downloader] Finished downloading {filename} successfully ({os.path.getsize(dest_path):,} bytes)!")
    sys.stdout.flush()
    return dest_path

if __name__ == "__main__":
    for fname, url in FILES:
        download_file(fname, url)
    print("[Kokoro Downloader] All Kokoro model assets verified in:", MODELS_DIR)
