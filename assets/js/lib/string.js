'use strict';

const string = (() => {

  const GLUE_WORDS = ['and', 'the', 'with'];
  const GLUE_WORDS_SET = new Set(GLUE_WORDS);

  function titlecase(s) {
    const words = s.split(' ');
    return [capitalizeFirstLetter(words[0]), ...words.slice(1).map(capitalizeWord)].join(' ');
  }

  function capitalize(s) {
    return s.split(' ').map(capitalizeFirstLetter).join(' ');
  }

  function capitalizeFirstLetter(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function capitalizeWord(s) {
    return GLUE_WORDS_SET.has(s) ? s : capitalizeFirstLetter(s);
  }

  return {
    titlecase,
    capitalize,
    capitalizeWord,
    capitalizeFirstLetter,
  } ;

})();

