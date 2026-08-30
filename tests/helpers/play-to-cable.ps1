# play-to-cable.ps1 — Play a WAV file to VB-CABLE Input using WinMM WaveOut API.
# Usage: powershell -NonInteractive -File play-to-cable.ps1 "C:\path\audio.wav" ["CABLE Input"]
#
# Uses WinMM's low-level WaveOut API so we can target the VB-CABLE Input device
# without changing the system default playback device. CABLE Input routes audio
# through VB-CABLE to CABLE Output, which the browser hears as its microphone.

param(
    [Parameter(Mandatory=$true)]  [string] $WavPath,
    [Parameter(Mandatory=$false)] [string] $DeviceNamePart = "CABLE Input"
)

Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

public static class WavePlayer {

    const uint WHDR_DONE    = 0x00000001;
    const int  CALLBACK_NULL = 0;

    // ── WAVEOUTCAPS ──────────────────────────────────────────────────────────
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct WAVEOUTCAPS {
        public ushort wMid, wPid;
        public uint   vDriverVersion;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string szPname;
        public uint   dwFormats, dwSupport2;
        public ushort wChannels, wReserved1;
    }

    // ── WAVEFORMATEX ─────────────────────────────────────────────────────────
    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    struct WAVEFORMATEX {
        public ushort wFormatTag, nChannels;
        public uint   nSamplesPerSec, nAvgBytesPerSec;
        public ushort nBlockAlign, wBitsPerSample, cbSize;
    }

    // ── WAVEHDR (blittable — safe to pin via GCHandle) ────────────────────
    [StructLayout(LayoutKind.Sequential)]
    struct WAVEHDR {
        public IntPtr lpData;
        public uint   dwBufferLength, dwBytesRecorded;
        public IntPtr dwUser;
        public uint   dwFlags, dwLoops;
        public IntPtr lpNext, reserved;
    }

    // ── WinMM P/Invoke ────────────────────────────────────────────────────
    [DllImport("winmm.dll")] static extern int waveOutGetNumDevs();

    [DllImport("winmm.dll", CharSet = CharSet.Unicode)]
    static extern int waveOutGetDevCaps(int uDeviceID, ref WAVEOUTCAPS pwoc, int cbwoc);

    [DllImport("winmm.dll")]
    static extern int waveOutOpen(ref IntPtr hWaveOut, int uDeviceID,
        ref WAVEFORMATEX lpFormat, IntPtr callback, IntPtr instance, int flags);

    [DllImport("winmm.dll")] static extern int waveOutClose(IntPtr hWaveOut);

    // Header operations: we pass IntPtr (addr of pinned WAVEHDR struct)
    [DllImport("winmm.dll")] static extern int waveOutPrepareHeader(IntPtr hWave, IntPtr pwh, int cbwh);
    [DllImport("winmm.dll")] static extern int waveOutWrite(       IntPtr hWave, IntPtr pwh, int cbwh);
    [DllImport("winmm.dll")] static extern int waveOutUnprepareHeader(IntPtr hWave, IntPtr pwh, int cbwh);

    // ── Public: list devices ──────────────────────────────────────────────
    public static void ListDevices() {
        int n = waveOutGetNumDevs();
        Console.WriteLine("WaveOut render devices (" + n + "):");
        for (int i = 0; i < n; i++) {
            var c = new WAVEOUTCAPS();
            waveOutGetDevCaps(i, ref c, Marshal.SizeOf(c));
            Console.WriteLine("  [" + i + "] " + c.szPname);
        }
    }

    // ── Public: find device index by name substring ───────────────────────
    public static int FindDevice(string namePart) {
        int n = waveOutGetNumDevs();
        for (int i = 0; i < n; i++) {
            var c = new WAVEOUTCAPS();
            waveOutGetDevCaps(i, ref c, Marshal.SizeOf(c));
            if (c.szPname != null && c.szPname.IndexOf(namePart, StringComparison.OrdinalIgnoreCase) >= 0)
                return i;
        }
        return -1;
    }

    // ── Public: play WAV file to a specific WaveOut device index ─────────
    public static void PlayWav(string wavPath, int devIdx) {
        byte[] wav = File.ReadAllBytes(wavPath);

        // Parse WAV RIFF chunks
        WAVEFORMATEX fmt = new WAVEFORMATEX();
        int dataOffset = -1, dataLength = 0;
        int pos = 12;
        while (pos < wav.Length - 8) {
            string tag  = System.Text.Encoding.ASCII.GetString(wav, pos, 4);
            int    size = BitConverter.ToInt32(wav, pos + 4);
            if (size < 0) break;
            if (tag == "fmt ") {
                fmt.wFormatTag      = BitConverter.ToUInt16(wav, pos + 8);
                fmt.nChannels       = BitConverter.ToUInt16(wav, pos + 10);
                fmt.nSamplesPerSec  = BitConverter.ToUInt32(wav, pos + 12);
                fmt.nAvgBytesPerSec = BitConverter.ToUInt32(wav, pos + 16);
                fmt.nBlockAlign     = BitConverter.ToUInt16(wav, pos + 20);
                fmt.wBitsPerSample  = BitConverter.ToUInt16(wav, pos + 22);
                fmt.cbSize          = 0;
            } else if (tag == "data") {
                dataOffset = pos + 8;
                dataLength = size;
                break;
            }
            pos += 8 + size;
            if (size % 2 != 0) pos++;
        }
        if (dataOffset < 0) throw new Exception("WAV file has no 'data' chunk");

        // Open WaveOut to the specific device
        IntPtr hWave = IntPtr.Zero;
        int err = waveOutOpen(ref hWave, devIdx, ref fmt, IntPtr.Zero, IntPtr.Zero, CALLBACK_NULL);
        if (err != 0) throw new Exception("waveOutOpen failed (err=" + err + ") for device [" + devIdx + "]");

        // Allocate unmanaged audio buffer
        IntPtr audioBuf = Marshal.AllocHGlobal(dataLength);
        Marshal.Copy(wav, dataOffset, audioBuf, dataLength);

        // Build WAVEHDR and pin it so the driver can write WHDR_DONE back into it
        var hdr = new WAVEHDR { lpData = audioBuf, dwBufferLength = (uint)dataLength };
        GCHandle gch     = GCHandle.Alloc(hdr, GCHandleType.Pinned);
        IntPtr   hdrPtr  = gch.AddrOfPinnedObject();
        int      hdrSize = Marshal.SizeOf(typeof(WAVEHDR));

        try {
            waveOutPrepareHeader(hWave, hdrPtr, hdrSize);
            waveOutWrite(hWave, hdrPtr, hdrSize);

            // Poll WHDR_DONE via the pinned pointer (driver sets it when buffer exhausted)
            double durationMs = (dataLength / (double)fmt.nAvgBytesPerSec) * 1000.0;
            int    maxWaitMs  = (int)(durationMs * 2.0) + 3000;
            int    waited     = 0;
            while (waited < maxWaitMs) {
                var cur = (WAVEHDR)Marshal.PtrToStructure(hdrPtr, typeof(WAVEHDR));
                if ((cur.dwFlags & WHDR_DONE) != 0) break;
                Thread.Sleep(30);
                waited += 30;
            }
            // Give OS a short tail so audio is fully rendered before we close
            Thread.Sleep(150);

            waveOutUnprepareHeader(hWave, hdrPtr, hdrSize);
        } finally {
            gch.Free();
            Marshal.FreeHGlobal(audioBuf);
            waveOutClose(hWave);
        }

        double secs = dataLength / (double)fmt.nAvgBytesPerSec;
        Console.WriteLine("[CABLE] Played " + secs.ToString("F2") + "s WAV to device [" + devIdx + "]");
    }
}
'@ -Language CSharp

# ── Main ─────────────────────────────────────────────────────────────────────
[WavePlayer]::ListDevices()

$devIdx = [WavePlayer]::FindDevice($DeviceNamePart)
if ($devIdx -lt 0) {
    Write-Error "No WaveOut device matching '$DeviceNamePart' found. Is VB-CABLE installed?"
    exit 1
}

Write-Host "[CABLE] Target device index: $devIdx"

if (-not (Test-Path $WavPath)) {
    Write-Error "WAV file not found: $WavPath"
    exit 1
}

try {
    [WavePlayer]::PlayWav($WavPath, $devIdx)
} catch {
    Write-Error "Playback failed: $_"
    exit 1
}
