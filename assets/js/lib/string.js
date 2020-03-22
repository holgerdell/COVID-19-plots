const GLUE_WORDS = ["and", "the", "with"];
const GLUE_WORDS_SET = new Set(GLUE_WORDS);

/**
 * @param {String} s
 *
 * @return {String}
 */
export function titlecase(s) {
  const words = s.split(" ");
  return [capitalizeFirstLetter(words[0]),
    ...words.slice(1).map(capitalizeWord)].join(" ");
}

/**
 * @param {String} s
 *
 * @return {String}
 */
export function capitalize(s) {
  return s.split(" ").map(capitalizeFirstLetter).join(" ");
}

/**
 * @param {String} s
 *
 * @return {String}
 */
export function capitalizeFirstLetter(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * @param {String} s
 *
 * @return {String}
 */
export function capitalizeWord(s) {
  return GLUE_WORDS_SET.has(s) ? s : capitalizeFirstLetter(s);
}
