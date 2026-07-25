var fs=require('fs');
var html=fs.readFileSync('C:/Users/28077/Desktop/web_test/project.html','utf8');

// Find the updateContrast function
var start = html.indexOf('    _contrastFrame: 0,');
var end = html.indexOf('\n    destroy: function()');
if (start < 0 || end < 0) { console.log('Not found'); process.exit(1); }
var beforeDestroy = html.lastIndexOf('},', end);

// Write the full debug version
var f =
'    _contrastFrame: 0,\n' +
'    updateContrast: function() {\n' +
'      var self = this;\n' +
'      if (!self.config.autoContrast) { self.container.classList.add("pb-light"); return; }\n' +
'      self._contrastFrame = (self._contrastFrame || 0) + 1;\n' +
'      if (self._contrastFrame % 15 !== 0) return;\n' +
'      // === DEBUG: visible sampling dots ===\n' +
'      var dbg = document.getElementById("pb-debug");\n' +
'      if (!dbg) {\n' +
'        dbg = document.createElement("div"); dbg.id = "pb-debug";\n' +
'        dbg.style.cssText = "position:fixed;top:0;left:0;z-index:99999;pointer-events:none;font:10px monospace;";\n' +
'        document.body.appendChild(dbg);\n' +
'      }\n' +
'      var lightVotes = 0, totalVotes = 0;\n' +
'      var dotsHTML = "";\n' +
'      for (var i = 0; i < 5; i++) {\n' +
'        var sx = window.innerWidth * (0.1 + i * 0.2);\n' +
'        var sy = window.innerHeight * 0.5;\n' +
'        var el = document.elementFromPoint(sx, sy);\n' +
'        if (!el) continue;\n' +
'        var walk = el, bg = "", tag = el.tagName;\n' +
'        while (walk && walk !== document.documentElement) {\n' +
'          if (walk.nodeType === 1) {\n' +
'            bg = getComputedStyle(walk).backgroundColor || "";\n' +
'            tag = walk.tagName + (walk.className ? "." + String(walk.className).split(" ")[0] : "") + (walk.id ? "#" + walk.id : "");\n' +
'            if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") break;\n' +
'          }\n' +
'          walk = walk.parentElement;\n' +
'        }\n' +
'        if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") {\n' +
'          bg = getComputedStyle(document.body).backgroundColor || "";\n' +
'          tag = "BODY";\n' +
'        }\n' +
'        var isDot = false;\n' +
'        if (bg.indexOf("rgb") >= 0) {\n' +
'          var parts = bg.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);\n' +
'          if (parts) {\n' +
'            var lum = (0.299*parseInt(parts[1]) + 0.587*parseInt(parts[2]) + 0.114*parseInt(parts[3])) / 255;\n' +
'            totalVotes++;\n' +
'            if (lum > 0.5) { lightVotes++; isDot = true; }\n' +
'          }\n' +
'        }\n' +
'        dotsHTML += "<span style=\"position:fixed;left:"+sx+"px;top:"+sy+"px;width:14px;height:14px;border-radius:50%;background:"+bg+";border:2px solid "+(isDot?"#000":"#fff")+";transform:translate(-50%,-50%)\" title=\""+tag+":"+bg+"\"></span>";\n' +
'      }\n' +
'      var isLight = totalVotes > 0 && lightVotes >= totalVotes * 0.5;\n' +
'      dotsHTML += "<div style=\"position:fixed;left:10px;top:50%;transform:translateY(40px);background:rgba(0,0,0,0.85);color:#0f0;padding:4px 8px;border-radius:3px;white-space:nowrap\">"+lightVotes+"/"+totalVotes+" light → "+(isLight?"LIGHT":"DARK")+" mode</div>";\n' +
'      dbg.innerHTML = dotsHTML;\n' +
'      self.container.classList.toggle("pb-light", isLight);\n' +
'    },\n' +
'\n' +
'    ';

html = html.substring(0, start) + f + html.substring(beforeDestroy + 2);
fs.writeFileSync('C:/Users/28077/Desktop/web_test/project.html', html);
console.log('Added debug sampling dots');
console.log('Refresh project.html?slug=test to see 5 colored dots + mode indicator at screen center');

var m = html.match(/<script>([\s\S]*?)<\/script>/);
fs.writeFileSync('C:/Users/28077/Desktop/web_test/_check_debug.js', m[1]);
