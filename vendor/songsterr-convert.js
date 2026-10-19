// Songsterr revision JSON -> alphaTab Score, bundled from Ryan Roberts' songsterr-downloader (MIT, see
// songsterr-convert.LICENSE): https://github.com/Metaphysics0/songsterr-downloader, src/lib/server/services/converter.
// Regenerate with the steps in DEVELOPING.md; don't edit by hand. Exposes globalThis.songsterrToScore(meta, revisions).

(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // g:at
  var require_at = __commonJS({
    "g:at"(exports, module) {
      module.exports = globalThis.alphaTab;
    }
  });

  // ../songsterr-downloader/src/lib/server/services/converter/songsterr-to-alphatab.converter.ts
  var alphaTab2 = __toESM(require_at(), 1);

  // ../songsterr-downloader/src/lib/server/services/converter/duration-mapper.ts
  var alphaTab = __toESM(require_at(), 1);
  var baseDurations = [
    alphaTab.model.Duration.Whole,
    alphaTab.model.Duration.Half,
    alphaTab.model.Duration.Quarter,
    alphaTab.model.Duration.Eighth,
    alphaTab.model.Duration.Sixteenth,
    alphaTab.model.Duration.ThirtySecond,
    alphaTab.model.Duration.SixtyFourth
  ];
  function mapSongsterrDuration(duration) {
    if (!duration) {
      return {
        duration: alphaTab.model.Duration.Quarter,
        dots: 0,
        isApproximate: true
      };
    }
    const [numerator, denominator] = duration;
    if (!numerator || !denominator) {
      return {
        duration: alphaTab.model.Duration.Quarter,
        dots: 0,
        isApproximate: true
      };
    }
    const targetValue = numerator / denominator;
    let bestDuration = alphaTab.model.Duration.Quarter;
    let bestDots = 0;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const candidateDuration of baseDurations) {
      const baseValue = 1 / Number(candidateDuration);
      for (const dots of [0, 1, 2]) {
        const dottedValue = baseValue + (dots >= 1 ? baseValue / 2 : 0) + (dots >= 2 ? baseValue / 4 : 0);
        const delta = Math.abs(dottedValue - targetValue);
        if (delta < bestDelta) {
          bestDelta = delta;
          bestDuration = candidateDuration;
          bestDots = dots;
        }
      }
    }
    return {
      duration: bestDuration,
      dots: bestDots,
      isApproximate: bestDelta > 1e-6
    };
  }

  // ../songsterr-downloader/src/lib/server/services/converter/instrument-map.ts
  function mapSongsterrInstrumentToPlayback(instrumentId) {
    if (instrumentId === 1024) {
      return {
        program: 0,
        isPercussion: true,
        primaryChannel: 9,
        secondaryChannel: 9
      };
    }
    const normalizedProgram = typeof instrumentId === "number" ? Math.min(Math.max(instrumentId, 0), 127) : 24;
    return {
      program: normalizedProgram,
      isPercussion: false
    };
  }

  // stub:stub
  var patchGp7Percussion = (d) => d;
  var patchGp7Harmonics = (d) => d;

  // ../songsterr-downloader/src/lib/server/services/converter/songsterr-to-alphatab.converter.ts
  var MAX_WARNINGS = 200;
  var velocityToDynamicMap = {
    ppp: alphaTab2.model.DynamicValue.PPP,
    pp: alphaTab2.model.DynamicValue.PP,
    p: alphaTab2.model.DynamicValue.P,
    mp: alphaTab2.model.DynamicValue.MP,
    mf: alphaTab2.model.DynamicValue.MF,
    f: alphaTab2.model.DynamicValue.F,
    ff: alphaTab2.model.DynamicValue.FF,
    fff: alphaTab2.model.DynamicValue.FFF
  };
  var harmonicTypeMap = {
    natural: alphaTab2.model.HarmonicType.Natural,
    artificial: alphaTab2.model.HarmonicType.Artificial,
    pinch: alphaTab2.model.HarmonicType.Pinch,
    tap: alphaTab2.model.HarmonicType.Tap,
    semi: alphaTab2.model.HarmonicType.Semi,
    feedback: alphaTab2.model.HarmonicType.Feedback
  };
  function getTupletRatio(tuplet) {
    switch (tuplet) {
      case 3:
        return [3, 2];
      case 5:
        return [5, 4];
      case 6:
        return [6, 4];
      case 7:
        return [7, 4];
      case 9:
        return [9, 8];
      case 10:
        return [10, 8];
      case 12:
        return [12, 8];
      default:
        if (tuplet > 1) {
          const denominator = Math.pow(2, Math.floor(Math.log2(tuplet)));
          return [tuplet, denominator];
        }
        return [1, 1];
    }
  }
  function buildPercussionIndexMap() {
    const score = new alphaTab2.model.Score();
    const mb = new alphaTab2.model.MasterBar();
    score.addMasterBar(mb);
    const track = new alphaTab2.model.Track();
    track.playbackInfo.primaryChannel = 9;
    track.playbackInfo.secondaryChannel = 9;
    const staff = new alphaTab2.model.Staff();
    staff.isPercussion = true;
    track.addStaff(staff);
    const bar = new alphaTab2.model.Bar();
    const voice = new alphaTab2.model.Voice();
    const beat = new alphaTab2.model.Beat();
    beat.isEmpty = true;
    voice.addBeat(beat);
    bar.addVoice(voice);
    staff.addBar(bar);
    score.addTrack(track);
    const settings = new alphaTab2.Settings();
    score.finish(settings);
    const exporter2 = new alphaTab2.exporter.Gp7Exporter();
    const data = exporter2.export(score, settings);
    const reimported = alphaTab2.importer.ScoreLoader.loadScoreFromBytes(
      data,
      settings
    );
    const map = /* @__PURE__ */ new Map();
    const articulations = reimported.tracks[0].percussionArticulations;
    for (let i = 0; i < articulations.length; i++) {
      const id = articulations[i].id;
      if (!map.has(id)) {
        map.set(id, i);
      }
    }
    return map;
  }
  var percussionIndexMap = null;
  function ensurePercussionIndexMap() {
    if (!percussionIndexMap) {
      percussionIndexMap = buildPercussionIndexMap();
    }
    return percussionIndexMap;
  }
  function getPercussionArticulationIndex(midiNote) {
    return ensurePercussionIndexMap().get(midiNote) ?? midiNote;
  }
  function encodeVariableLengthQuantity(value) {
    const bytes = [value & 127];
    let remaining = value >> 7;
    while (remaining > 0) {
      bytes.unshift(remaining & 127 | 128);
      remaining >>= 7;
    }
    return bytes;
  }
  function addTrackNamesToMidi(midiData, trackNames) {
    const bytes = Array.from(midiData);
    const headerSize = 14;
    let offset = headerSize;
    for (let trackIndex = 0; trackIndex < trackNames.length; trackIndex++) {
      if (offset + 8 > bytes.length) break;
      const chunkId = String.fromCharCode(
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3]
      );
      if (chunkId !== "MTrk") {
        throw new Error(`Unexpected MIDI chunk ${chunkId} at offset ${offset}`);
      }
      const length = bytes[offset + 4] << 24 | bytes[offset + 5] << 16 | bytes[offset + 6] << 8 | bytes[offset + 7];
      const trackDataStart = offset + 8;
      const trackDataEnd = trackDataStart + length;
      const trackName = trackNames[trackIndex] || `Track ${trackIndex + 1}`;
      const trackNameBytes = Array.from(new TextEncoder().encode(trackName));
      const metaEvent = [
        0,
        255,
        3,
        ...encodeVariableLengthQuantity(trackNameBytes.length),
        ...trackNameBytes
      ];
      bytes.splice(trackDataStart, 0, ...metaEvent);
      const newLength = length + metaEvent.length;
      bytes[offset + 4] = newLength >> 24 & 255;
      bytes[offset + 5] = newLength >> 16 & 255;
      bytes[offset + 6] = newLength >> 8 & 255;
      bytes[offset + 7] = newLength & 255;
      offset = trackDataEnd + metaEvent.length;
    }
    return Uint8Array.from(bytes);
  }
  var SongsterrToAlphaTabConverter = class {
    toGp7(input) {
      const { score, settings, warnings } = this.buildScore(input);
      score.finish(settings);
      const exporter2 = new alphaTab2.exporter.Gp7Exporter();
      const data = patchGp7Harmonics(patchGp7Percussion(exporter2.export(score, settings)));
      return { data, warnings };
    }
    toMidi(input, options = {}) {
      const { score, settings, warnings } = this.buildScore(input);
      score.finish(settings);
      const midiFile = new alphaTab2.midi.MidiFile();
      midiFile.format = options.separateTracks ? alphaTab2.midi.MidiFileFormat.MultiTrack : alphaTab2.midi.MidiFileFormat.SingleTrackMultiChannel;
      const handler = new alphaTab2.midi.AlphaSynthMidiFileHandler(midiFile, true);
      const generator = new alphaTab2.midi.MidiFileGenerator(score, settings, handler);
      generator.generate();
      let data = midiFile.toBinary();
      if (options.separateTracks) {
        const trackNames = score.tracks.map((track, index) => {
          const candidate = track.name?.trim() || track.shortName?.trim();
          return candidate || `Track ${index + 1}`;
        });
        data = addTrackNamesToMidi(data, trackNames);
      }
      return { data, warnings };
    }
    buildScore({ meta, revisions }) {
      const warnings = [];
      ensurePercussionIndexMap();
      const score = new alphaTab2.model.Score();
      score.title = meta.title;
      score.artist = meta.artist;
      score.tab = "Songsterr Downloader";
      const masterTrack = this.pickMasterTrack(revisions);
      const masterBarCount = Math.max(1, this.getMasterBarCount(revisions));
      this.buildMasterBars({
        score,
        masterTrack,
        masterBarCount,
        warnings
      });
      let nextChannel = 0;
      for (const entry of revisions) {
        const instrumentId = entry.trackMeta.instrumentId ?? entry.revision.instrumentId;
        const isPercussion = instrumentId === 1024 || !!entry.trackMeta.isDrums;
        let channel;
        if (isPercussion) {
          channel = 9;
        } else {
          if (nextChannel === 9) nextChannel++;
          channel = nextChannel;
          nextChannel++;
        }
        this.buildTrack({
          score,
          entry,
          masterBarCount,
          warnings,
          channel
        });
      }
      const settings = new alphaTab2.Settings();
      score.finish(settings);
      return { score, settings, warnings };
    }
    buildMasterBars({
      score,
      masterTrack,
      masterBarCount,
      warnings
    }) {
      let timeSignatureNumerator = 4;
      let timeSignatureDenominator = 4;
      for (let index = 0; index < masterBarCount; index++) {
        const measure = masterTrack?.measures?.[index];
        const signature = this.getValidSignature(measure?.signature);
        if (signature) {
          [timeSignatureNumerator, timeSignatureDenominator] = signature;
        }
        const masterBar = new alphaTab2.model.MasterBar();
        masterBar.timeSignatureNumerator = timeSignatureNumerator;
        masterBar.timeSignatureDenominator = timeSignatureDenominator;
        if (measure?.marker) {
          const section = new alphaTab2.model.Section();
          const markerText = this.extractMarkerText(measure.marker);
          section.marker = markerText;
          section.text = markerText;
          masterBar.section = section;
        }
        if (measure?.repeatStart) {
          masterBar.isRepeatStart = true;
        }
        const repeatCount = typeof measure?.repeat === "number" ? measure.repeat : typeof measure?.repeatCount === "number" ? measure.repeatCount : 0;
        if (repeatCount > 0) {
          masterBar.repeatCount = repeatCount;
        }
        const alternateEnding = measure?.alternateEnding;
        let alternateMask = 0;
        if (Array.isArray(alternateEnding)) {
          for (const n of alternateEnding) {
            if (typeof n === "number" && n >= 1 && n <= 8) {
              alternateMask |= 1 << n - 1;
            }
          }
        } else if (typeof alternateEnding === "number" && alternateEnding > 0) {
          alternateMask = alternateEnding;
        }
        if (alternateMask) {
          masterBar.alternateEndings = alternateMask;
        }
        if (measure?.doubleBarline) {
          masterBar.isDoubleBar = true;
        }
        score.addMasterBar(masterBar);
      }
      const tempoPoints = this.findTempoPoints(masterTrack);
      this.applyTempoAutomations(score, tempoPoints, warnings);
    }
    buildTrack({
      score,
      entry,
      masterBarCount,
      warnings,
      channel
    }) {
      const { trackMeta, revision } = entry;
      const playbackMapping = mapSongsterrInstrumentToPlayback(
        trackMeta.instrumentId ?? revision.instrumentId
      );
      const track = new alphaTab2.model.Track();
      track.name = trackMeta.title || trackMeta.name || revision.name || "Track";
      track.shortName = track.name.slice(0, 20);
      track.playbackInfo.program = playbackMapping.program;
      track.playbackInfo.primaryChannel = channel;
      track.playbackInfo.secondaryChannel = channel;
      const staff = new alphaTab2.model.Staff();
      const tuning = revision.tuning || trackMeta.tuning;
      if (Array.isArray(tuning) && tuning.length > 0) {
        staff.stringTuning = new alphaTab2.model.Tuning("Custom", tuning, false);
      }
      const isPercussion = playbackMapping.isPercussion || !!trackMeta.isDrums;
      staff.isPercussion = isPercussion;
      const numStrings = Array.isArray(tuning) ? tuning.length : 6;
      let maxVoiceCount = 1;
      for (let i = 0; i < masterBarCount; i++) {
        const m = revision.measures?.[i];
        maxVoiceCount = Math.max(maxVoiceCount, m?.voices?.length || 0);
      }
      for (let measureIndex = 0; measureIndex < masterBarCount; measureIndex++) {
        const bar = new alphaTab2.model.Bar();
        const measure = revision.measures?.[measureIndex];
        const voiceCount = measure?.voices?.length || 0;
        if (voiceCount === 0) {
          const voice = new alphaTab2.model.Voice();
          this.fillWithRestBeats(voice, score.masterBars[measureIndex]);
          bar.addVoice(voice);
        } else {
          for (let voiceIndex = 0; voiceIndex < voiceCount; voiceIndex++) {
            const voice = new alphaTab2.model.Voice();
            const sourceVoice = measure.voices[voiceIndex];
            this.fillVoice({
              voice,
              sourceVoice,
              masterBar: score.masterBars[measureIndex],
              warnings,
              locationPrefix: `track:${trackMeta.partId}|measure:${measureIndex}|voice:${voiceIndex}`,
              isPercussion,
              numStrings
            });
            bar.addVoice(voice);
          }
        }
        for (let v = bar.voices.length; v < maxVoiceCount; v++) {
          const restVoice = new alphaTab2.model.Voice();
          this.fillWithRestBeats(restVoice, score.masterBars[measureIndex]);
          bar.addVoice(restVoice);
        }
        staff.addBar(bar);
      }
      track.addStaff(staff);
      score.addTrack(track);
    }
    fillVoice({
      voice,
      sourceVoice,
      masterBar,
      warnings,
      locationPrefix,
      isPercussion,
      numStrings
    }) {
      const beats = sourceVoice?.beats || [];
      if (beats.length === 0 || sourceVoice?.rest) {
        this.fillWithRestBeats(voice, masterBar);
        return;
      }
      for (let beatIndex = 0; beatIndex < beats.length; beatIndex++) {
        const beatData = beats[beatIndex];
        const beat = this.mapBeat(
          beatData,
          warnings,
          `${locationPrefix}|beat:${beatIndex}`,
          isPercussion,
          numStrings
        );
        voice.addBeat(beat);
      }
      if (voice.beats.length === 0) {
        this.fillWithRestBeats(voice, masterBar);
      }
    }
    mapBeat(beatData, warnings, location, isPercussion, numStrings) {
      const beat = new alphaTab2.model.Beat();
      if (beatData.rest) {
        beat.isEmpty = true;
      }
      const mappedDuration = mapSongsterrDuration(beatData.duration);
      beat.duration = mappedDuration.duration;
      beat.dots = beatData.dots ?? mappedDuration.dots;
      const rawText = beatData.text;
      const textStr = typeof rawText === "string" ? rawText : rawText?.text;
      beat.text = textStr || null;
      if (mappedDuration.isApproximate && !beatData.tuplet) {
        this.pushWarning(warnings, {
          code: "duration_approximated",
          message: `Approximated unsupported duration ${JSON.stringify(
            beatData.duration
          )}`,
          location
        });
      }
      if (typeof beatData.graceNote === "string") {
        const gn = beatData.graceNote.toLowerCase();
        if (gn === "beforebeat") {
          beat.graceType = alphaTab2.model.GraceType.BeforeBeat;
        } else if (gn === "onbeat") {
          beat.graceType = alphaTab2.model.GraceType.OnBeat;
        }
      }
      if (typeof beatData.tuplet === "number" && beatData.tuplet > 1) {
        const [num, den] = getTupletRatio(beatData.tuplet);
        beat.tupletNumerator = num;
        beat.tupletDenominator = den;
        if (typeof beatData.type === "number" && beatData.type > 0) {
          const baseDuration = mapSongsterrDuration([1, beatData.type]);
          beat.duration = baseDuration.duration;
          beat.dots = beatData.dots ?? 0;
        }
      }
      if (typeof beatData.velocity === "string") {
        const mappedDynamic = velocityToDynamicMap[beatData.velocity.toLowerCase()];
        if (typeof mappedDynamic === "number") {
          beat.dynamics = mappedDynamic;
        } else {
          this.pushWarning(warnings, {
            code: "velocity_unknown",
            message: `Unsupported beat velocity "${beatData.velocity}"`,
            location
          });
        }
      }
      if (typeof beatData.pickStroke === "string") {
        const ps = beatData.pickStroke.toLowerCase();
        if (ps === "down") {
          beat.pickStroke = alphaTab2.model.PickStroke.Down;
        } else if (ps === "up") {
          beat.pickStroke = alphaTab2.model.PickStroke.Up;
        }
      }
      if (beatData.wideVibrato || beatData.vibratoWithTremoloBar) {
        beat.vibrato = alphaTab2.model.VibratoType.Wide;
      } else if (beatData.vibrato) {
        beat.vibrato = alphaTab2.model.VibratoType.Slight;
      }
      const notes = beatData.notes || [];
      for (let noteIndex = 0; noteIndex < notes.length; noteIndex++) {
        const noteData = notes[noteIndex];
        if (noteData.rest) {
          continue;
        }
        const note = this.mapNote(
          noteData,
          beatData,
          warnings,
          `${location}|note:${noteIndex}`,
          isPercussion,
          numStrings
        );
        beat.addNote(note);
      }
      return beat;
    }
    mapNote(noteData, beatData, warnings, location, isPercussion, numStrings) {
      const note = new alphaTab2.model.Note();
      note.string = isPercussion ? -1 : numStrings - (noteData.string ?? 0);
      note.fret = noteData.fret ?? 0;
      if (isPercussion) {
        note.percussionArticulation = getPercussionArticulationIndex(
          noteData.fret ?? 0
        );
      }
      if (noteData.tie) {
        note.isTieDestination = true;
      }
      if (noteData.dead) {
        note.isDead = true;
      }
      if (noteData.ghost) {
        note.isGhost = true;
      }
      if (noteData.hp) {
        note.isHammerPullOrigin = true;
      }
      if (noteData.staccato) {
        note.isStaccato = true;
      }
      if (noteData.accentuated) {
        note.accentuated = alphaTab2.model.AccentuationType.Normal;
      }
      if (beatData.palmMute) {
        note.isPalmMute = true;
      }
      if (noteData.wideVibrato) {
        note.vibrato = alphaTab2.model.VibratoType.Wide;
      } else if (noteData.vibrato) {
        note.vibrato = alphaTab2.model.VibratoType.Slight;
      }
      if (typeof noteData.slide === "string") {
        this.mapSlide(note, noteData.slide, warnings, location);
      }
      if (typeof noteData.harmonic === "string") {
        this.mapHarmonic(note, noteData, warnings, location);
      }
      if (noteData.bend && noteData.bend.points && noteData.bend.points.length > 0) {
        this.mapBend(note, noteData.bend);
      }
      return note;
    }
    mapSlide(note, slide, warnings, location) {
      const normalizedSlide = slide.toLowerCase();
      if (normalizedSlide === "shift") {
        note.slideOutType = alphaTab2.model.SlideOutType.Shift;
        return;
      }
      if (normalizedSlide === "legato") {
        note.slideOutType = alphaTab2.model.SlideOutType.Legato;
        return;
      }
      if (normalizedSlide === "into_from_below" || normalizedSlide === "below") {
        note.slideInType = alphaTab2.model.SlideInType.IntoFromBelow;
        return;
      }
      if (normalizedSlide === "into_from_above") {
        note.slideInType = alphaTab2.model.SlideInType.IntoFromAbove;
        return;
      }
      if (normalizedSlide === "out_up") {
        note.slideOutType = alphaTab2.model.SlideOutType.OutUp;
        return;
      }
      if (normalizedSlide === "out_down" || normalizedSlide === "downwards") {
        note.slideOutType = alphaTab2.model.SlideOutType.OutDown;
        return;
      }
      this.pushWarning(warnings, {
        code: "slide_unsupported",
        message: `Unsupported slide effect "${slide}"`,
        location
      });
    }
    mapHarmonic(note, noteData, warnings, location) {
      const harmonicStr = noteData.harmonic.toLowerCase();
      const mappedType = harmonicTypeMap[harmonicStr];
      if (typeof mappedType === "number") {
        note.harmonicType = mappedType;
        if (typeof noteData.harmonicFret === "number") {
          note.harmonicValue = noteData.harmonicFret;
        }
      } else {
        this.pushWarning(warnings, {
          code: "harmonic_unsupported",
          message: `Unsupported harmonic type "${noteData.harmonic}"`,
          location
        });
      }
    }
    mapBend(note, bend) {
      const points = bend.points;
      if (!points || points.length === 0) return;
      const toAlphaTabValue = (tone) => Math.round(tone / 25);
      const firstTone = points[0].tone;
      const isPrebend = firstTone > 0;
      if (isPrebend) {
        const firstVal = toAlphaTabValue(firstTone);
        const lastPoint = points[points.length - 1];
        const destVal = toAlphaTabValue(lastPoint.tone);
        const maxTone = Math.max(...points.map((p) => p.tone));
        if (maxTone > firstTone) {
          note.bendType = alphaTab2.model.BendType.PrebendBend;
          const maxVal = toAlphaTabValue(maxTone);
          note.addBendPoint(new alphaTab2.model.BendPoint(0, firstVal));
          note.addBendPoint(new alphaTab2.model.BendPoint(60, maxVal));
        } else if (lastPoint.tone < firstTone) {
          note.bendType = alphaTab2.model.BendType.PrebendRelease;
          note.addBendPoint(new alphaTab2.model.BendPoint(0, firstVal));
          note.addBendPoint(new alphaTab2.model.BendPoint(60, destVal));
        } else {
          note.bendType = alphaTab2.model.BendType.Prebend;
          note.addBendPoint(new alphaTab2.model.BendPoint(0, firstVal));
          note.addBendPoint(new alphaTab2.model.BendPoint(60, destVal));
        }
        return;
      }
      note.bendType = alphaTab2.model.BendType.Custom;
      let pointsToUse = points;
      if (points.length > 4) {
        let maxTone = 0;
        let peakIdx = 0;
        for (let i = 0; i < points.length; i++) {
          if (points[i].tone >= maxTone) {
            maxTone = points[i].tone;
            peakIdx = i;
          }
        }
        if (peakIdx === 0 || peakIdx === points.length - 1) {
          pointsToUse = [points[0], points[points.length - 1]];
        } else {
          pointsToUse = [points[0], points[peakIdx], points[points.length - 1]];
        }
      }
      for (const point of pointsToUse) {
        const offset = Math.round(point.position);
        const value = toAlphaTabValue(point.tone);
        note.addBendPoint(new alphaTab2.model.BendPoint(offset, value));
      }
    }
    fillWithRestBeats(voice, masterBar) {
      const denominator = masterBar.timeSignatureDenominator || 4;
      const numerator = masterBar.timeSignatureNumerator || 4;
      const mappedDuration = mapSongsterrDuration([1, denominator]);
      for (let i = 0; i < numerator; i++) {
        const restBeat = new alphaTab2.model.Beat();
        restBeat.isEmpty = true;
        restBeat.duration = mappedDuration.duration;
        restBeat.dots = mappedDuration.dots;
        voice.addBeat(restBeat);
      }
    }
    getMasterBarCount(revisions) {
      return revisions.reduce((max, entry) => {
        return Math.max(max, entry.revision?.measures?.length || 0);
      }, 0);
    }
    pickMasterTrack(revisions) {
      if (revisions.length === 0) {
        return null;
      }
      return revisions.reduce((longest, current) => {
        const currentLength = current.revision?.measures?.length || 0;
        const longestLength = longest.revision?.measures?.length || 0;
        return currentLength > longestLength ? current : longest;
      }).revision;
    }
    getValidSignature(signature) {
      if (!Array.isArray(signature) || signature.length !== 2) {
        return null;
      }
      const [numerator, denominator] = signature;
      if (!numerator || !denominator) {
        return null;
      }
      return [numerator, denominator];
    }
    extractMarkerText(marker) {
      if (typeof marker === "string") {
        return marker;
      }
      if (marker && typeof marker === "object" && typeof marker.text === "string") {
        return marker.text;
      }
      return "";
    }
    findTempoPoints(masterTrack) {
      const tempo = masterTrack?.automations?.tempo;
      return Array.isArray(tempo) ? tempo : [];
    }
    applyTempoAutomations(score, points, warnings) {
      for (const point of points) {
        const barIndex = point.measure;
        const masterBar = score.masterBars[barIndex];
        if (!masterBar) {
          this.pushWarning(warnings, {
            code: "tempo_measure_out_of_range",
            message: `Tempo automation references missing measure ${barIndex}`,
            location: `measure:${barIndex}`
          });
          continue;
        }
        const tempoReference = 2;
        const ratioPosition = point.position > 0 ? Math.max(0, Math.min(1, point.position / (point.type || 4))) : 0;
        const tempoAutomation = alphaTab2.model.Automation.buildTempoAutomation(
          false,
          ratioPosition,
          point.bpm,
          tempoReference,
          true
        );
        masterBar.tempoAutomations.push(tempoAutomation);
      }
    }
    pushWarning(warnings, warning) {
      if (warnings.length < MAX_WARNINGS) {
        warnings.push(warning);
      }
    }
  };

  // entry.ts
  globalThis.songsterrToScore = (meta, revisions) => new SongsterrToAlphaTabConverter().buildScore({ meta, revisions });
})();
