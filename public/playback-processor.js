// AudioWorklet processor for streaming PCM16 playback via ring buffer
class PlaybackProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.ringBuffer = new Int16Array(24000 * 30); // 30s at 24kHz
        this.writePos = 0;
        this.readPos = 0;

        this.port.onmessage = (e) => {
            if (e.data === "clear") {
                // Handle interruption — reset buffer
                this.readPos = this.writePos;
                return;
            }
            const chunk = new Int16Array(e.data);
            for (let i = 0; i < chunk.length; i++) {
                this.ringBuffer[this.writePos % this.ringBuffer.length] = chunk[i];
                this.writePos++;
            }
            // Prevent overflow
            if (this.readPos > this.ringBuffer.length * 2 && this.writePos > this.ringBuffer.length * 2) {
                const offset = this.readPos - (this.readPos % this.ringBuffer.length);
                this.readPos -= offset;
                this.writePos -= offset;
            }
        };
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0][0];
        for (let i = 0; i < output.length; i++) {
            if (this.readPos < this.writePos) {
                output[i] = this.ringBuffer[this.readPos % this.ringBuffer.length] / 32768.0;
                this.readPos++;
            } else {
                output[i] = 0;
            }
        }
        return true;
    }
}

registerProcessor("playback-processor", PlaybackProcessor);
