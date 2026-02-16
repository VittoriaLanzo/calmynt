(function initTodayOS(global, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    global.TodayOS = factory();
  }
}(typeof window !== 'undefined' ? window : globalThis, function buildTodayOS() {
  const DEFAULT_BUFFER_MIN = 5;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function formatTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function toMinutes(timeValue) {
    const [hours, minutes] = timeValue.split(':').map(Number);
    return hours * 60 + minutes;
  }

  function parseDuration(text) {
    if (!text) return null;
    const lower = text.toLowerCase();
    const hourMatch = lower.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)/);
    if (hourMatch) {
      return Math.round(parseFloat(hourMatch[1]) * 60);
    }
    const minMatch = lower.match(/(\d+)\s*(m|min|mins|minute|minutes)/);
    if (minMatch) {
      return parseInt(minMatch[1], 10);
    }
    return null;
  }

  function parseRelativeTime(text) {
    if (!text) return null;
    const lower = text.toLowerCase();
    const match = lower.match(/\bin\s+(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours)\b/);
    if (!match) return null;
    const value = parseFloat(match[1]);
    const unit = match[2];
    if (unit.startsWith('h')) {
      return Math.round(value * 60);
    }
    return Math.round(value);
  }

  function parseTime(text) {
    if (!text) return null;
    const lower = text.toLowerCase();
    let dateShift = 0;
    if (lower.includes('tomorrow')) dateShift = 1;

    const h24 = lower.match(/\b([01]?\d|2[0-3])[:.](\d{2})\b/);
    if (h24) {
      const hours = String(h24[1]).padStart(2, '0');
      const minutes = String(h24[2]).padStart(2, '0');
      return { time: `${hours}:${minutes}`, dateShift };
    }

    const h12 = lower.match(/\b(1[0-2]|0?[1-9])(?::(\d{2}))?\s*(am|pm)\b/);
    if (h12) {
      let hour = parseInt(h12[1], 10);
      const minutes = h12[2] ? parseInt(h12[2], 10) : 0;
      const meridian = h12[3];
      if (meridian === 'pm' && hour < 12) hour += 12;
      if (meridian === 'am' && hour === 12) hour = 0;
      return { time: `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`, dateShift };
    }

    if (lower.includes('tomorrow') || /\bat\b/.test(lower)) {
      const hourOnly = lower.match(/\b([01]?\d|2[0-3])\b/);
      if (hourOnly) {
        const hour = String(hourOnly[1]).padStart(2, '0');
        return { time: `${hour}:00`, dateShift };
      }
    }

    return null;
  }

  function extractTags(text) {
    const tags = [];
    const cleaned = text.replace(/#([a-z0-9_-]+)/gi, (match, tag) => {
      tags.push(tag.toLowerCase());
      return '';
    });
    return { tags, cleaned: cleaned.replace(/\s+/g, ' ').trim() };
  }

  function estimateDuration(text, kind) {
    const explicit = parseDuration(text);
    if (explicit) return clamp(explicit, 5, 240);
    const lower = (text || '').toLowerCase();
    if (kind === 'event') return 30;
    if (/(essay|study|homework|revision|reading)/.test(lower)) return 50;
    if (/(email|message|dm|inbox)/.test(lower)) return 10;
    if (/(call|phone|zoom|meet)/.test(lower)) return 15;
    return 25;
  }

  function triageInput(text, nowMinutes) {
    const trimmed = (text || '').trim();
    if (!trimmed) return null;
    const { tags, cleaned } = extractTags(trimmed);
    const timeMatch = parseTime(cleaned);
    const relativeMinutes = parseRelativeTime(cleaned);
    const kind = timeMatch ? 'event' : 'task';
    const duration = estimateDuration(cleaned, kind);
    const startMinutes = timeMatch ? toMinutes(timeMatch.time) : null;
    let suggestedStart = kind === 'task' ? nowMinutes : startMinutes;
    if (kind === 'task' && relativeMinutes) {
      suggestedStart = nowMinutes + relativeMinutes;
    }
    return {
      kind,
      title: cleaned,
      tags,
      duration,
      start: timeMatch ? timeMatch.time : null,
      dateShift: timeMatch ? timeMatch.dateShift : 0,
      suggestedStart,
      relativeMinutes,
    };
  }

  function applyHardCaps(tasks, priority) {
    const mustCount = tasks.filter((t) => t.priority === 'must').length;
    const optionalCount = tasks.filter((t) => t.priority === 'optional').length;
    if (priority === 'must') return mustCount < 3;
    if (priority === 'optional') return optionalCount < 2;
    return true;
  }

  function insertBuffers(blocks, bufferMinutes = DEFAULT_BUFFER_MIN) {
    const buffer = clamp(bufferMinutes, 5, 10);
    const result = [];
    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i];
      result.push(block);
      const next = blocks[i + 1];
      if (next) {
        const bufferBlock = {
          id: `${block.id}_buffer_${i}`,
          kind: 'buffer',
          start: formatTime(block.startMinutes + block.duration),
          startMinutes: block.startMinutes + block.duration,
          duration: buffer,
        };
        result.push(bufferBlock);
      }
    }
    return result;
  }

  function autoReplan({ nowMinutes, blocks, bufferMinutes = DEFAULT_BUFFER_MIN, dayEndMinutes = 23 * 60 }) {
    const buffer = clamp(bufferMinutes, 5, 10);
    const sorted = [...blocks].sort((a, b) => {
      if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
      return (a.order || 0) - (b.order || 0);
    });
    const protectedBlocks = sorted.filter((b) => b.protected).sort((a, b) => a.startMinutes - b.startMinutes);
    const deferred = [];
    const replanned = [];
    let cursor = nowMinutes;

    sorted.forEach((block) => {
      if (block.protected) {
        replanned.push(block);
        cursor = Math.max(cursor, block.startMinutes + block.duration + buffer);
        return;
      }

      const nextProtected = protectedBlocks.find((p) => p.startMinutes >= cursor);
      let start = Math.max(cursor, block.startMinutes);
      if (nextProtected && start + block.duration + buffer > nextProtected.startMinutes) {
        deferred.push(block);
        return;
      }
      if (start + block.duration > dayEndMinutes) {
        deferred.push(block);
        return;
      }
      replanned.push({ ...block, startMinutes: start, start: formatTime(start) });
      cursor = start + block.duration + buffer;
    });

    return { replanned, deferred };
  }

  function buildSchedule(blocks, bufferMinutes) {
    const scheduled = blocks
      .filter((b) => typeof b.startMinutes === 'number')
      .sort((a, b) => a.startMinutes - b.startMinutes);
    return insertBuffers(scheduled, bufferMinutes);
  }

  return {
    clamp,
    formatTime,
    toMinutes,
    parseDuration,
    parseRelativeTime,
    parseTime,
    estimateDuration,
    triageInput,
    applyHardCaps,
    insertBuffers,
    autoReplan,
    buildSchedule,
  };
}));
