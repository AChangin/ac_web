var fs=require('fs');
var html=fs.readFileSync('C:/Users/28077/Desktop/web_test/project.html','utf8');

// Replace elementFromPoint with elementsFromPoint (plural)
// This function returns ALL elements including pointer-events:none ones
html = html.replace(/document\.elementFromPoint\(sx, sy\)/g, 'document.elementsFromPoint(sx, sy)[0]');

// Also fix the walk loop to handle elementsFromPoint returning array
// The [0] gets the topmost element, which is what we want

fs.writeFileSync('C:/Users/28077/Desktop/web_test/project.html', html);
console.log('Changed elementFromPoint → elementsFromPoint');

var m = html.match(/<script>([\s\S]*?)<\/script>/);
fs.writeFileSync('C:/Users/28077/Desktop/web_test/_check_ep.js', m[1]);
