const GLUE_WORDS = ["and", "the", "with"];
const GLUE_WORDS_SET = new Set(GLUE_WORDS);

export function titlecase(s) {
  const words = s.split(" ");
  return [capitalizeFirstLetter(words[0]),
    ...words.slice(1).map(capitalizeWord)].join(" ");
}

export function capitalize(s) {
  return s.split(" ").map(capitalizeFirstLetter).join(" ");
}

export function capitalizeFirstLetter(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function capitalizeWord(s) {
  return GLUE_WORDS_SET.has(s) ? s : capitalizeFirstLetter(s);
}
