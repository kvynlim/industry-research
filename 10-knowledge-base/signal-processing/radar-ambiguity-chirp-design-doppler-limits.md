# Radar Ambiguity, Chirp Design, and Doppler Limits

Radar waveform design is a tradeoff between range resolution, maximum range,
Doppler resolution, unambiguous velocity, sidelobes, hardware limits, and
regulatory constraints. The ambiguity function is the first-principles tool:
it describes how a transmitted waveform responds to echoes with different time
delays and Doppler shifts.

---

## Related docs

- [FMCW, MIMO, and Doppler Radar Fundamentals](radar-fmcw-mimo-doppler.md)
- [Sampling, FFT, Windowing, and Filtering](sampling-fft-windowing-filtering.md)
- [CFAR Detection and Thresholding](cfar-detection-thresholding.md)
- [Sensor Likelihoods, Noise, and Error Budgets](../sensors/sensor-likelihoods-noise-error-budgets.md)
- [Data Association and Gating](../state-estimation/data-association-and-gating.md)

---

## Why it matters for AV, perception, SLAM, and mapping

Automotive radar is valued because it gives direct radial velocity and works in
conditions that challenge camera and LiDAR. But radar is not a magic velocity
sensor. Chirp design determines what ranges and velocities are distinguishable,
where aliases occur, and how ghosts or sidelobes enter the perception stack.

For AV perception, these choices affect missed pedestrians, split vehicles,
static/dynamic separation, and tracker velocity covariance. For SLAM and
mapping, they affect which reflectors are stable enough to become landmarks.

---

## Core math and algorithm steps

### Ambiguity function

For transmitted complex baseband waveform `s(t)`, the narrowband ambiguity
function is:

```
chi(tau, fd) =
  integral s(t) s*(t - tau) exp(-j 2 pi fd t) dt
```

Large values mean an echo delayed by `tau` and Doppler shifted by `fd` looks
similar to the reference signal. Good waveform design shapes this surface so
that desired targets are separable and sidelobes are controlled.

### FMCW chirp basics

For a linear FMCW chirp:

```
f_tx(t) = f_c + S t
S = B / T_chirp
```

Round-trip delay:

```
tau = 2 R / c
```

Beat frequency from range:

```
f_b ~= S tau = 2 S R / c
R = c f_b / (2 S)
```

Range resolution:

```
delta_R = c / (2 B)
```

Maximum beat frequency must fit the ADC and analog bandwidth:

```
f_b,max <= f_adc / 2
R_max <= c f_adc / (4 S)
```

The practical `R_max` also depends on RF power, antenna gain, RCS, noise
figure, and CFAR threshold.

### Doppler from slow time

Across chirps, phase changes reveal radial velocity:

```
fd = 2 v_r / lambda
v_r = lambda fd / 2
```

If chirps repeat every `T_c`, Doppler sampling rate is:

```
f_slow = 1 / T_c
```

Approximate unambiguous Doppler:

```
|fd| < 1 / (2 T_c)
|v_r| < lambda / (4 T_c)
```

Doppler bin spacing for `N_chirps`:

```
delta_fd = 1 / (N_chirps T_c)
delta_v = lambda / (2 N_chirps T_c)
```

Longer coherent processing improves velocity resolution but increases latency
and assumes target motion is coherent over the frame.

### Range-Doppler coupling

In FMCW radar, moving targets contribute both delay and Doppler. For one chirp:

```
f_beat ~= 2 S R / c + 2 v_r / lambda
```

Up-chirp and down-chirp pairs, multiple slopes, or chirp sequences help
separate range and velocity. Single-slope designs can suffer coupling when
velocity is large relative to range beat frequency.

### Chirp design tradeoffs

| Parameter | Increasing it helps | Increasing it hurts |
|---|---|---|
| Bandwidth `B` | range resolution | RF/ADC bandwidth, regulation, noise power |
| Chirp duration `T_chirp` | lower beat frequency for same range | unambiguous velocity if chirp repetition slows |
| Number of chirps | Doppler resolution and SNR | latency, motion coherence |
| Chirp slope `S` | range sensitivity | max range for fixed ADC rate |
| Window sidelobe suppression | fewer false peaks near strong targets | wider main lobes |
| MIMO virtual aperture | angle resolution | Doppler-angle coupling in TDM-MIMO |

### Processing chain

```
ADC samples per chirp
  -> range window and range FFT
  -> clutter or DC removal
  -> Doppler window and Doppler FFT across chirps
  -> CFAR in range-Doppler or range-angle-Doppler
  -> angle estimation and Doppler compensation
  -> ambiguity checks and tracker handoff
```

---

## Implementation notes

- Keep chirp parameters with every radar frame: slope, bandwidth, sample rate,
  chirp repetition interval, number of chirps, carrier frequency, and TX order.
- Compute range and Doppler axes from metadata, not hardcoded constants.
- Surface ambiguous velocity flags to the tracker. A wrapped Doppler should not
  be fused as a high-confidence velocity.
- TDM-MIMO needs Doppler compensation before angle estimation for moving
  targets.
- Calibrate static range bias and antenna phase. Small phase errors can become
  angle bias.
- Use synthetic targets and corner reflectors to verify bin mapping, sign
  conventions, and Doppler wrapping.

---

## Failure modes and diagnostics

| Failure mode | Symptom | Diagnostic |
|---|---|---|
| Doppler aliasing | Fast object appears with wrong velocity sign or magnitude. | Track velocity crosses unambiguous limit; wrapped bins visible. |
| Range-Doppler coupling | Range estimate shifts with target speed. | Compare up/down chirp or multi-slope residuals. |
| Sidelobe false alarms | Detections around bright vehicle or aircraft. | Inspect range-Doppler sidelobe structure before CFAR. |
| TDM-MIMO phase error | Moving targets have biased angle. | Angle residual changes with Doppler bin. |
| Motion decorrelation | Long frame smears maneuvering targets. | Doppler peak broadens with acceleration. |
| Wrong metadata | All ranges or velocities scaled incorrectly. | Corner reflector and turntable tests. |
| Mutual interference | Bursts of false peaks or raised floor. | Time-frequency inspection and radar co-channel logs. |

---

## Sources

- Texas Instruments, "Introduction to mmWave Sensing: FMCW Radars": https://training.ti.com/intro-mmwave-sensing-fmcw-radars
- Texas Instruments, "MIMO Radar": https://www.ti.com/lit/an/swra554a/swra554a.pdf
- Sun et al., "Signal Processing for TDM MIMO FMCW Millimeter-Wave Radar Sensors": https://doaj.org/article/daaa8af0eb8043a685faf1df71e5414d
- Richards radar signal processing topics: https://mrichards.ece.gatech.edu/tableofcontents/
- NTIA ISART proceedings, radar ambiguity and LFM discussion: https://its.ntia.gov/publications/download/12-485.pdf
- "Ambiguity Function Shaping in FMCW Automotive Radar": https://arxiv.org/abs/2402.16754
- OpenRadar Doppler processing documentation: https://openradar.readthedocs.io/en/latest/dsp/doppler_processing.html
