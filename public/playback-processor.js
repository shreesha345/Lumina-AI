// AudioWorklet processor for streaming PCM16 playback via ring buffer
class PlaybackProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        // 30 seconds at 24kHz
        this.capacity = 24000 * 30;
        this.ringBuffer = new Float32Array(this.capacity); // store as float directly
        this.writePos = 0;
        this.readPos = 0;

        // Buffering state to prevent cracking
        this.playing = false;
        // Wait for ~150ms of audio before starting playback
        this.bufferThreshold = 24000 * 0.15;

        this.port.onmessage = (e) => {
            if (e.data === "clear") {
                // Interruption — fully reset
                this.ringBuffer.fill(0);
                this.writePos = 0;
                this.readPos = 0;
                this.playing = false;
                return;
            }

            // Incoming data is an ArrayBuffer of Int16 PCM
            const int16 = new Int16Array(e.data);
            const len = int16.length;

            for (let i = 0; i < len; i++) {
                this.ringBuffer[this.writePos % this.capacity] = int16[i] / 32768.0;
                this.writePos++;
            }

            // If writer lapped the reader, snap reader forward to avoid stale/garbled audio
            const buffered = this.writePos - this.readPos;
            if (buffered > this.capacity) {
                this.readPos = this.writePos - this.capacity;
            }
        };
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        if (!output || !output[0]) return true;

        const channel = output[0];
        const len = channel.length;
        let buffered = this.writePos - this.readPos;

        // Start playing when we've buffered enough, stop if we run dry
        if (!this.playing && buffered >= this.bufferThreshold) {
            this.playing = true;
        } else if (this.playing && buffered === 0) {
            this.playing = false;
        }

        for (let i = 0; i < len; i++) {
            if (this.playing && this.readPos < this.writePos) {
                channel[i] = this.ringBuffer[this.readPos % this.capacity];
                this.readPos++;
            } else {
                channel[i] = 0; // Fill with silence
            }
        }

        // Prevent unbounded index growth — normalize both positions periodically
        // Only when indices are very large (no data corruption since we use modulo)
        if (this.readPos > this.capacity * 100) {
            buffered = this.writePos - this.readPos;
            this.readPos = this.readPos % this.capacity;
            this.writePos = this.readPos + buffered;
        }

        return true;
    }
}

registerProcessor("playback-processor", PlaybackProcessor);
