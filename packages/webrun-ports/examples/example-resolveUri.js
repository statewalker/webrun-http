import resolveUrl from "../src/resolveUrl.js";
console.log(resolveUrl('http://foo.bar/a/b/', '../doc/', './my/path.txt'))
// 'http://foo.bar/a/doc/my/path.txt'
