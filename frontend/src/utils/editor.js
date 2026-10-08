export function groupSentences(words) {
  const groups = [];
  let current = [];
  words.forEach((word, index) => {
    current.push({ word, index });
    const next = words[index + 1];
    if (/[。！？.!?，,]$/.test(word.word || '') || !next || next.start - word.end > 0.45 || current.length >= 18) {
      groups.push(current);
      current = [];
    }
  });
  return groups;
}

export function captionTextAt(groups, time) {
  for (const group of groups) {
    const active = group.map(item => item.word).filter(word => !word.auto_delete && !word.user_delete);
    if (active.length && active[0].start <= time && time < active.at(-1).end) {
      return active.map(word => word.word).join('').replace(/\\/g, '＼').replace(/\{/g, '｛').replace(/\}/g, '｝');
    }
  }
  return '';
}

export function isEditingTarget(target) {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || !!target?.isContentEditable;
}
