/* Shared exhibition mix: active 50 ms RMS, bounded gain, and peak headroom.
 * Audio files remain untouched. Quiet tails do not inflate the gain estimate. */
(function (scope) {
  'use strict';
  const measured = new WeakMap();
  function measure(buffer) {
    if (measured.has(buffer)) return measured.get(buffer);
    const channels = Array.from({length: buffer.numberOfChannels}, (_, i) => buffer.getChannelData(i));
    const block = Math.max(1, Math.round(buffer.sampleRate * .05)), windows = [];
    let peak = 0, maxEnergy = 0;
    for (let start = 0; start < buffer.length; start += block) {
      let sum = 0, count = 0;
      for (const data of channels) for (let i = start; i < Math.min(start + block, buffer.length); i++) {
        const value = data[i]; sum += value * value; count++; peak = Math.max(peak, Math.abs(value));
      }
      const energy = sum / Math.max(1, count); windows.push(energy); maxEnergy = Math.max(maxEnergy, energy);
    }
    const active = windows.filter(v => v > Math.max(1e-7, maxEnergy * .01));
    const rms = Math.sqrt(active.reduce((sum, v) => sum + v, 0) / Math.max(1, active.length));
    const result = {peak, rms}; measured.set(buffer, result); return result;
  }
  function sampleGain(buffer, target = .12) {
    const {rms, peak} = measure(buffer);
    return peak < .00001 ? 0 : Math.min(8, target / Math.max(rms, .001), .7 / peak);
  }
  function output(context) {
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -8; limiter.knee.value = 6; limiter.ratio.value = 8;
    limiter.attack.value = .003; limiter.release.value = .15;
    const level = context.createGain(); level.gain.value = .8;
    limiter.connect(level); level.connect(context.destination);
    return {input: limiter, output: level};
  }
  scope.GameAudio = Object.freeze({measure, sampleGain, output});
})(globalThis);
