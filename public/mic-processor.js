// AudioWorklet processor for capturing microphone input as PCM16
// Buffers samples and sends them in larger chunks to reduce WebSocket message overhead
class MicProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        // Buffer ~100ms of audio at 16kHz = 1600 samples before sending
        this.bufferSize = 1600;
        this.buffer = new Int16Array(this.bufferSize);
        this.bufferIndex = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input && input[0] && input[0].length > 0) {
            const float32 = input[0];
            for (let i = 0; i < float32.length; i++) {
                const s = Math.max(-1, Math.min(1, float32[i]));
                this.buffer[this.bufferIndex] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                this.bufferIndex++;

                // When buffer is full, send the chunk
                if (this.bufferIndex >= this.bufferSize) {
                    const chunk = this.buffer.slice(0, this.bufferIndex);
                    this.port.postMessage(chunk.buffer, [chunk.buffer]);
                    // Allocate a new buffer since we transferred ownership
                    this.buffer = new Int16Array(this.bufferSize);
                    this.bufferIndex = 0;
                }
            }
        }
        return true;
    }
}

registerProcessor("mic-processor", MicProcessor);
