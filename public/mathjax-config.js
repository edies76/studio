window.MathJax = {
  tex: {
    inlineMath: [
      ['\\(', '\\)'],
      ['$', '$'],
    ],
    displayMath: [
      ['\\[', '\\]'],
      ['$$', '$$'],
    ],
    processEscapes: true,
    processEnvironments: true,
  },
  options: {
    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
    enableMenu: false,
  },
  chtml: {
    displayAlign: 'center',
    displayIndent: '0',
    matchFontHeight: true,
  },
  startup: { typeset: false },
};
